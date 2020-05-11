'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
var tcp = require('net');
const events = require('events');
//const emitter = new events.EventEmitter;

const protoBuf = require('protobufjs');
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

  constructor (options) {
    super();

    this._settings = {};

    if (typeof options.port === 'undefined') {
      options.port = 56747;
    } 
    this._settings = options;
    
    this.txheader = Buffer.alloc(38).fill(0);

    this.isdiscovered = false;
    this.isconnected = false;
    this.wasconnected = false;
    this.iswriting = false;
    this.isreading = false;

    this.sock = new tcp.Socket();
    this.sock.setNoDelay(true);

    this.sock.on('connect', () => {
      console.log('connected to comfoAir unit');

      this.isconnected = true;
    })

    this.sock.on('timeout', () => {
      console.log(' TCP socket timeout');
      let reason = {
        error: 'timeout'
      }
      this.emit('error', reason);
      this.isconnected = false;
    })

    this.sock.on('data', (data) => {
      let msglen = -1 ;
      let offset = 0;
      let datalen = data.length

      // search the receive buffer for multiple messages received at the same time
      while (offset < datalen) {
        msglen = data.readInt32BE(offset);
        let buffer = data.slice(offset, offset + msglen + 4)
        let rxdata = {
          'time': new Date(),
          'data': buffer,
          'kind': -1,
          'msg': null
        }

        if (this._settings.debug) {
          console.log(" <- RX : " + data.toString("hex"));
        }
        this.emit('received', rxdata);

        offset += msglen + 4
      }

    })

    this.sock.on('error', (err) => {
      console.error('sock error: ' + err);
      let reason = {
        error: err
      }
      this.emit('error', reason);
    })

    this.sock.on('close', (had_error) => {
      if (had_error) {
        console.log("TCP socket closed with error");
      } else {
        console.log("TCP socket closed");
      }

      this.emit('disconnect');
      this.isconnected = false;
    })

    this.sock.on('end', () => {
      console.log("TCP socket ended");

      this.isconnected = false;
    })

  }

  // discovery of the ventilation unit / LAN C adapter
  async discovery() {
    let listener = udp.createSocket('udp4');
    
    return new Promise((resolve, reject) => {
      listener.bind(this._settings.port, () => {
        let txdata = Buffer.from('0a00', 'hex');

        if (typeof this.settings.port === 'undefined') {
          this.settings.port = 56747;
        }
        if (this.settings.port == 0) {
          this.settings.port = 56747;
        }
        if (this._settings.debug) {
          console.log(" -> TX : " + txdata.toString("hex"));
        }

        if (this._settings.comfoair == null) {
          listener.addMembership(this._settings.multicast);
          listener.setBroadcast(true);
  
          listener.send(txdata, this._settings.port, null);
        } else {
          listener.send(txdata, this._settings.port, this._settings.comfoair);
        }
      });
    
      listener.on('message', (message, remote) => {
        if (this._settings.debug) {
          console.log(" <- RX : " + message.toString("hex"));
          console.log("         (" + remote.address + ':' + remote.port +  ")")
        }
                  
        let protoData = messages.DiscoveryOperation.decode(message);
        this._settings.comfoair = protoData.searchGatewayResponse.ipaddress;
        this._settings.comfoUuid = protoData.searchGatewayResponse.uuid;

        listener.close();

        // preparation of the TX header
        this._settings.uuid.copy(this.txheader, 4);
        this._settings.comfoUuid.copy(this.txheader, 20);
        //this.txheader.writeInt16LE(4, 32);
    
        resolve(this._settings);
      })

      listener.on('error', (err) => {
        reject(err);
      })

    })
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
}

ComfoAirQBridge.prototype.discover =  async function (options) {

  this._settings.multicast = options.multicast;
  this._settings.comfoair  = options.comfoair;


  return new Promise((resolve,reject) => {
    //let result = null;
  
    try {
      this.discovery()
        .then((result) => {
          resolve(result);
        });
      
    } catch (exc) {
      reject(exc);
    }
  })
    
}

ComfoAirQBridge.prototype.transmit = async function (data) {
  if (!this.isconnected) {
    this.sock.connect(this._settings.port, this._settings.comfoair);
    do {
      await sleep(50);
    } while (!this.isconnected);
  }

  return new Promise((resolve, reject) => {
    let op_len = data.operation.length;
    let msg_len = 16 + 16 + 2 + data.command.length + data.operation.length;
    let txdata = Buffer.concat([this.txheader, data.operation, data.command]);
    
    txdata.writeInt16BE(op_len, 36);
    txdata.writeInt32BE(msg_len, 0);

    if (this._settings.debug) {
      console.log(" -> TX : " + txdata.toString("hex"));
    }

    this.sock.write(txdata, (err) => {
      if (err) {
        console.log("error sending data: " + err);
        reject(err);
      }
      
      resolve('OK');
    });
  });
}

module.exports = ComfoAirQBridge;

