'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
var tcp = require('net');
const events = require('events');
const emitter = new events.EventEmitter;

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const after = require('./analysis')

var bridge = null;

class zehnderBridge extends events {

  constructor (options) {
    if (typeof options.port === 'undefined') {
      options.port = 56747;
    } 

    this.options = options;
    this.txheader = Buffer.alloc(38).fill(0);

    this.isconnected = false;
    this.wasconnected = false;
    this.iswriting = false;
    this.isreading = false;

    this.rxdata = [];
    this.txdata = [];

    this.sock = new tcp.Socket();
    this.sock.setNoDelay(true);

    this.sock.on('connect', () => {
      console.log('connected to comfoAir unit');

      this.isconnected = true;
      this.sendBuffer();
    })

    this.sock.on('drain', () => {
      console.log(' TCP buffer drained');
    })
    this.sock.on('timeout', () => {
      console.log(' TCP socket timeout');
    })

    this.sock.on('data', (data) => {
      let msglen = -1 ;
      let offset = 0;
      let datalen = data.length

      // search the receive buffer for multiple messages received at the same time
      while (offset < datalen) {
        msglen = data.readInt32BE(offset);
        let buffer = data.slice(offset, offset + msglen + 4)
        let rxed = {
          'time': new Date(),
          'data': buffer,
          'kind': -1,
          'msg': null
        }
        this.rxdata.push(rxed);

        offset += msglen + 4
      }

      emitter.emit('received');

    })

    this.sock.on('error', (err) => {
      console.error('sock error: ' + err);
    })
    this.sock.on('close', (had_error) => {
      if (had_error) {
        console.log("TCP socket closed with error");
      } else {
        console.log("TCP socket closed");
      }

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
      listener.bind(this.options.port, () => {
  
        if (this.options.comfoair == null) {
          listener.addMembership(this.options.multicast);
          listener.setBroadcast(true);
  
          listener.send(Buffer.from('0a00', 'hex'), this.options.port, null);
        } else {
          listener.send(Buffer.from('0a00', 'hex'), this.options.port, this.options.comfoair);
        }
      });
    
      listener.on('message', (message, remote) => {
        console.log('recv: (' + remote.address + ':' + remote.port +  ') : ' + message.toString('hex'));
          
        let protoData = messages.DiscoveryOperation.decode(message);
        this.options.comfoair = protoData.searchGatewayResponse.ipaddress;
        this.options.comfoUuid = protoData.searchGatewayResponse.uuid;

        listener.close();

        // preparation of the TX header
        this.options.uuid.copy(this.txheader, 4);
        this.options.comfoUuid.copy(this.txheader, 20);
        //this.txheader.writeInt16LE(4, 32);
    
        resolve(this.options);
      })

      listener.on('error', (err) => {
        reject(err);
      })

    })
  }

  sendBuffer() {
    this.iswriting = true;
      
    if (!this.isconnected) {
      this.sock.connect(this.options.port, this.options.comfoair);
      //setTimeout(this.sendBuffer, 100);
      return;
    }

    if (this.txdata.length > 0) {
      let txdata = this.txdata.shift();
      this.sock.write(txdata, (err) => {
        if (err) {
          console.log("error sending data: " + err);
        //  reject(err);
        }
        this.iswriting = false;
      });
    } 
  }

}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function discover(options, callback) {
  if (bridge == null) {
    bridge = new zehnderBridge(options);
  }
  let result = null;
  
  try {
    result = await bridge.discovery();
  } catch (exc) {
    console.log(exc);
  }
  finally {
    callback(result);
  }
  
}

async function sendBuffer(options = null, data = null, debug = false) {

  // the bridge must exist.
  // if not: run discovery first
  if (bridge == null) {
    bridge = new zehnderBridge(options);

    await bridge.discovery();
  }

  if ((options == null) && (data == null)) {
    if (bridge.txdata.length > 0) {
      if (!bridge.iswriting) {
        bridge.sendBuffer();
      }
      setTimeout(sendBuffer, 100);
      return;
    }
  }

  try {

    // create the datastream to transmit
    let op_len = data.operation.length;
    let msg_len = 16 + 16 + 2 + data.command.length + data.operation.length;
    let txdata = Buffer.concat([bridge.txheader, data.operation, data.command]);
    
    txdata.writeInt16BE(op_len, 36);
    txdata.writeInt32BE(msg_len, 0)

    if (debug) {
      console.log(" -> TX : " + txdata.toString("hex"));
    }

    bridge.txdata.push(txdata);
    if (!bridge.iswriting) {
      bridge.sendBuffer();
    }
    

  }
  catch (exc) {
    console.error(exc);
  }
  
}

function receiveBuffer(debug = false) {
  return new Promise(async (resolve, reject) => {
    try {
      let loopcnt = 0;

      if (bridge == null) {
        throw new Error('timeout simulation because not yet initialized');
      }
      // loop until something is received or timeout
      do {
        await sleep(50);
        if (loopcnt++ == 100) {
          throw new Error('receive timeout')
        }
      } while (bridge.rxdata.length == 0)
      

      let rxdata = bridge.rxdata.shift();

      if (debug) {
        console.log(" <- RX : " + rxdata.data.toString("hex"));
      }
      rxdata.msg = after.cmd_GatewayOperation(rxdata.data);
      rxdata.error = rxdata.msg.result;
      rxdata.kind = rxdata.msg.type;

      resolve(rxdata);
      
    }
    catch (exc) {
      reject(exc)
    }
  })
}

module.exports = {
  bridge,

  discover,
  sendBuffer,
  receiveBuffer
}    
