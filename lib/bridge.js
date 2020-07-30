'use strict';

const debug = require('debug');
const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
const tcp = require('net');
const events = require('events');

const protoBuf = require('protobufjs');
//const { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } = require('constants');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
//const after = require('./analysis')

/*
const bridgeStatus = {
  NOT_CONFIGURED = 0,
  DISCOVERED = 1,
  NOT_CONNECTED = 2,
  CONNECTED = 3,
  OTHER_SESSION = 4
}
*/
class ComfoAirQBridge extends events {

  constructor(options) {
    super();

    //this._settings = {};
    //if (typeof options.port === 'undefined') {
    //  options.port = 56747;
    //} 
    this._settings = options;
    
    this.isdiscovered = false;
    this.isconnected = false;

    this.txheader = Buffer.alloc(38).fill(0);
    // if comfoUuid is already known, the TX header can be prepared
    if (this._settings.comfoUuid) {
      if (this._settings.debug) {
        debug('bridge constructor: comfoUuid already known');
      }
      this._settings.uuid.copy(this.txheader, 4);
      this._settings.comfoUuid.copy(this.txheader, 20);

      this.isdiscovered = true;
    } else if (this._settings.debug) {
      debug('bridge constructor: comfoUuid not known -> discovery needed');
    }

    this.initSocket();
    
  }

  initSocket () {
    this.sock = new tcp.Socket();

    this.sock.setNoDelay(true);
    this.sock.setTimeout(10000);
    this.sock.setKeepAlive(true, 15000);

    this.sock.on('connect', () => {
      debug('bridge : connected to comfoAir unit -> ' + getTimestamp());

      this.isconnected = true;
    });

    this.sock.on('timeout', () => {
      console.log('bridge : TCP socket timeout -> ' + getTimestamp());
      const reason = {
        error: 'timeout'
      };
      if (this.isconnected) {
        this.emit('error', reason);
        this.sock.end('timeout detected');
      }
      //this.sock.destroy('timeout detected');
      this.isconnected = false;
    });

    this.sock.on('data', (data) => {
      let msglen = -1 ;
      let offset = 0;
      const datalen = data.length;

      // search the receive buffer for multiple messages received at the same time
      while (offset < datalen) {
        msglen = data.readInt32BE(offset);
        const buffer = data.slice(offset, offset + msglen + 4);
        const rxdata = {
          'time': new Date(),
          'data': buffer,
          'kind': -1,
          'msg': null
        };

        if (this._settings.debug) {
          debug(' <- RX : ' + buffer.toString('hex'));
        }
        this.emit('received', rxdata);

        offset += msglen + 4;
      }

    });

    this.sock.on('error', (err) => {
      console.error('bridge : sock error: ' + err + ' -> ' + getTimestamp());
      const reason = {
        error: err
      };
      this.sock.end('socket error');
      this.emit('error', reason);
    });

    this.sock.on('close', (had_error) => {

      if (had_error) {
        debug('bridge : TCP socket closed with error -> ' + getTimestamp());
      } else {
        debug('bridge : TCP socket closed -> ' + getTimestamp());
      }

      //this.sock.end('socket closed');
      this.isconnected = false;
      this.emit('disconnect');
      this.sock.destroy();
      
    });

    this.sock.on('end', () => {
      debug('bridge : TCP socket ended -> ' + getTimestamp());
    
      // the socket will close
      //this.isconnected = false;
    });

  }

  // discovery of the ventilation unit / LAN C adapter
  async discovery() {
    const listener = udp.createSocket('udp4');
    
    return new Promise((resolve, reject) => {
      listener.bind(this._settings.port, () => {
        const txdata = Buffer.from('0a00', 'hex');

        //if ((typeof this.settings.port === 'undefined') ||
        //    (this.settings.port == 0)) {
        //  this.settings.port = 56747;
        //}
    
        if (this._settings.debug) {
          console.log(' -> TX (UDP) : ' + txdata.toString('hex'));
        }

        if (this._settings.comfoair == null) {
          listener.addMembership(this._settings.multicast);
          listener.setBroadcast(true);
  
          listener.send(txdata, this._settings.port, null);
        } else {
          listener.send(txdata, this._settings.port, this._settings.comfoair);
        }
      });

      listener.on('error', (err) => {
        reject(err);
      });

      listener.on('close', () => {
        // preparation of the TX header
        this._settings.uuid.copy(this.txheader, 4);
        this._settings.comfoUuid.copy(this.txheader, 20);

        const result = {
          'localUuid' : this._settings.uuid,
          'comfoUuid' : this._settings.comfoUuid,
          'device'    : this._settings.comfoair,
          'port'      : this._settings.port
        };
        resolve(result);
      });
    
      listener.on('message', (message, remote) => {
        if (this._settings.debug) {
          console.log(' <- RX (UDP) : ' + message.toString('hex'));
          console.log('         (' + remote.address + ':' + remote.port +  ')');
        }
                  
        const protoData = messages.DiscoveryOperation.decode(message);
        this._settings.comfoair = protoData.searchGatewayResponse.ipaddress;
        this._settings.comfoUuid = protoData.searchGatewayResponse.uuid;

        listener.close();
      });

    });
  }

  get settings() {
    return this._settings;
  }
  set settings(value) {
    this._settings = value;
  }
}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

const getTimestamp = () => {
  const current_datetime = new Date();
            
  return current_datetime.getFullYear() + '-' + (current_datetime.getMonth() + 1) + '-' + current_datetime.getDate() + ' ' 
                           + current_datetime.getHours() + ':' + current_datetime.getMinutes() + ':' + current_datetime.getSeconds();
};

//ComfoAirQBridge.prototype.discover =  async function (options) {
ComfoAirQBridge.prototype.discover =  async function () {

  return new Promise((resolve,reject) => {
    //let result = null;
  
    try {
      this.discovery()
        .then((result) => {
          if (this._settings.debug) {
            console.log('  discovery complete -> ' + getTimestamp());
          }
          this.isdiscovered = true;
          resolve(result);
        });
      
    } 
    catch (exc) {
      reject(exc);
    }
  });
    
};

ComfoAirQBridge.prototype.transmit = async function (data) {
  if (!this.isconnected) {
   
    while (!this.isdiscovered) {
      await sleep(25);
    }

    if (this.sock.destroyed) {
      this.initSocket();
    }

    this.sock.connect(this._settings.port, this._settings.comfoair);

    while (!this.isconnected) {
      await sleep(25);
    }
  }

  return new Promise((resolve, reject) => {
    const op_len = data.operation.length;
    const msg_len = 16 + 16 + 2 + data.command.length + data.operation.length;
    const txdata = Buffer.concat([this.txheader, data.operation, data.command]);
    
    txdata.writeInt16BE(op_len, 36);
    txdata.writeInt32BE(msg_len, 0);

    if (this._settings.debug) {
      console.log(' -> TX : ' + txdata.toString('hex'));
    }

    this.sock.write(txdata, (err) => {
      if (err) {
        console.log('bridge : error sending data -> ' + err + ' -> ' + getTimestamp());
        reject(err);
      }
      
      resolve('OK');
    });
  });
};

module.exports = ComfoAirQBridge;
