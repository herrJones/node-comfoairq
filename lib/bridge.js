'use strict';

const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
const tcp = require('net');
const events = require('events');

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');

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

    this._settings = options;

    // Prepare header by using the settings
    this.txheader = Buffer.alloc(38).fill(0);
    this._settings.uuid.copy(this.txheader, 4);
    this._settings.comfoUuid.copy(this.txheader, 20);

    this.discoveredDevice = {
      'comfoair': null,
      'comfoUuid': null,
    };

    this.isconnected = false;
    this.iswriting = false;
    this.isreading = false;

    this.initSocket();
  }

  initSocket() {
    this.sock = new tcp.Socket();

    this.sock.setNoDelay(true);
    this.sock.setTimeout(10000);
    this.sock.setKeepAlive(true, 15000);

    this.sock.on('connect', () => {
      console.log('bridge : connected to comfoAir unit -> ' + (new Date(Date.now())).toLocaleString());

      this.isconnected = true;
    });

    this.sock.on('timeout', () => {
      console.log('bridge : TCP socket timeout -> ' + (new Date(Date.now())).toLocaleString());
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
      let msglen = -1;
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
          console.log(' <- RX : ' + buffer.toString('hex'));
        }
        this.emit('received', rxdata);

        offset += msglen + 4;
      }

    });

    this.sock.on('error', (err) => {
      console.error('bridge : sock error: ' + err + ' -> ' + (new Date(Date.now())).toLocaleString());
      const reason = {
        error: err
      };
      this.sock.end('socket error');
      this.emit('error', reason);
    });

    this.sock.on('close', (had_error) => {
      if (had_error) {
        console.log('bridge : TCP socket closed with error -> ' + (new Date(Date.now())).toLocaleString());
      } else {
        console.log('bridge : TCP socket closed -> ' + (new Date(Date.now())).toLocaleString());
      }

      //this.sock.end('socket closed');
      this.isconnected = false;
      this.emit('disconnect');
      this.sock.destroy();

    });

    this.sock.on('end', () => {
      console.log('bridge : TCP socket ended -> ' + (new Date(Date.now())).toLocaleString());

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

        if (this._settings.debug) {
          console.log(' -> TX (UDP) : ' + txdata.toString('hex'));
        }

        if (this._settings.comfoAir == null) {
          listener.addMembership(this._settings.multicast);
          listener.setBroadcast(true);

          listener.send(txdata, this._settings.port, null);
        } else {
          listener.send(txdata, this._settings.port, this._settings.comfoAir);
        }
      });

      listener.on('error', (err) => {
        reject(err);
      });

      listener.on('close', () => {
        // preparation of the TX header

        resolve(this.discoveredDevice);
      });

      listener.on('message', (message, remote) => {
        if (this._settings.debug) {
          console.log(' <- RX (UDP) : ' + message.toString('hex'));
          console.log('         (' + remote.address + ':' + remote.port + ')');
        }

        const protoData = messages.DiscoveryOperation.decode(message);

        this.discoveredDevice = {
            'comfoAir': protoData.searchGatewayResponse.ipaddress,
            'comfoUuid': protoData.searchGatewayResponse.uuid,
        };

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

ComfoAirQBridge.prototype.discover = async function() {

  return new Promise((resolve, reject) => {

    try {
      this.discovery()
        .then((result) => {
          if (this._settings.debug) {
            console.log('  discovery complete -> ' + (new Date(Date.now())).toLocaleString());
          }
          resolve(result);
        });

    } catch (exc) {
      reject(exc);
    }

  });

};

ComfoAirQBridge.prototype.transmit = async function(data) {
  if (!this.isconnected) {

    if (this.sock.destroyed) {
      this.initSocket();
    }

    this.sock.connect(this._settings.port, this._settings.comfoAir);

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
        console.log('bridge : error sending data -> ' + err + ' -> ' + (new Date(Date.now())).toLocaleString());
        reject(err);
      }

      resolve('OK');
    });
  });
};

module.exports = ComfoAirQBridge;