'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
var tcp = require('net');
//var events = require('events');
//const fs = require('fs');
//const protoBuf = require('protocol-buffers');
//const messages = protoBuf(fs.readFileSync(__dirname + '/protocol/zehnder.proto'));
const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const after = require('./analysis')

var bridge = null;

class zehnderBridge {

  constructor (options) {
    if (typeof options.port === 'undefined') {
      options.port = 56747;
    } 
  
    if (typeof options.localUuid === 'undefined') {
      options.localUuid = Buffer.from('00000000000000000000000000000005', 'hex')
    } 

    this.options = options;
    this.txheader = Buffer.alloc(38).fill(0);

    this.connected = false;

    this.rxdata = [];
    this.txdata = null;

    this.sock = new tcp.Socket();
    this.sock.setNoDelay(true);

    this.sock.on('error', (err) => {
      console.error(err);
    })

    this.sock.on('data', (data) => {
      let msglen = -1 ;
      let offset = 0;
      let datalen = data.length

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

    })

    this.sock.on('close', (had_error) => {
      if (had_error) {
        console.log("TCP socket closed with error");
      } else {
        console.log("TCP socket closed");
      }
      //this.rxoffset = 0;
      this.connected = false;
    })
    this.sock.on('end', () => {
      console.log("TCP socket ended");

      //this.rxoffset = 0;
      this.connected = false;
    })

  }

  async discovery() {

    let listener = udp.createSocket('udp4');
    
    return new Promise((resolve, reject) => {
      //listener.bind()
      listener.bind(this.options.port, () => {
  
        if (this.options.host == null) {
          listener.addMembership(this.options.multicast);
          listener.setBroadcast(true);
  
          listener.send(Buffer.from('0a00', 'hex'), this.options.port, null);
        } else {
          listener.send(Buffer.from('0a00', 'hex'), this.options.port, this.options.host);
        }
      });
    
      listener.on('message', (message, remote) => {
        console.log('recv: (' + remote.address + ':' + remote.port +  ') : ' + message.toString('hex'));
    
        // RECV : 12200a0a31302e38312e352e3631121000000000000910138001144fd71e13cb1801
        // UUID :                                 00000000000910138001144fd71e13cb
          
         let protoData = messages.DiscoveryOperation.decode(message);
         this.options.host = protoData.searchGatewayResponse.ipaddress;
         this.options.comfoUuid = protoData.searchGatewayResponse.uuid;

         listener.close();

         // preparation of the TX header
         this.options.localUuid.copy(this.txheader, 4);
         this.options.comfoUuid.copy(this.txheader, 20);
         //this.txheader.writeInt16LE(4, 32);
    
         resolve(this.options);
      })

      listener.on('error', (err) => {
        reject(err);
      })

      

    })
  }

  async sendBuffer(txdata) {
    let comfo = this;
    //let rxOffset = comfo.sock.bytesRead;

    return new Promise((resolve, reject) => {

      if (comfo.connected) {

        comfo.sock.write(txdata, (err) => {
          //console.log('sent buffer to comfoAir unit');
          
          if (err) {
            console.log("error sending data: " + err);
            reject(err);
          }
          resolve('ok');
        })
      } else {
        comfo.sock.connect(comfo.options.port, comfo.options.host, () => {
          console.log('connected to comfoAir unit');

          if (debug) {
            console.log(" -> TX : " + txdata.toString("hex"));
          }

          comfo.connected = true;
          comfo.sock.write(txdata, (err) => {
            //console.log('sent buffer to comfoAir unit');

            if (err) {
              console.log("error sending data: " + err);
              reject(err);
            }

            resolve('ok');
          })
        })
      }      
    })
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

async function sendBuffer(options, data, debug = false) {

  if (bridge == null) {
    bridge = new zehnderBridge(options);

    await bridge.discovery();
  }

  try {

    let op_len = data.operation.length;
    let msg_len = 16 + 16 + 2 + data.command.length + data.operation.length;
    let txBuffer = Buffer.concat([bridge.txheader, data.operation, data.command]);
    
    txBuffer.writeInt16BE(op_len, 36);
    txBuffer.writeInt32BE(msg_len, 0)

    if (debug) {
      console.log(" -> TX : " + txdata.toString("hex"));
    }

    bridge.sendBuffer(txBuffer, false);

  }
  catch (exc) {
    console.error(exc);
  }
  
}

function receiveBuffer(debug = false) {
  return new Promise(async (resolve, reject) => {
    try {
      let loopcnt = 0;
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

/*
exports.discover = function (options, cb) {
  var bridge = comfoBridge(options);

  bridge.comfoAir.discover(cb);
  return bridge;
}

var comfoBridge = function (options) {
  var zehnder = {};
  zehnder.options = parseOptions(options);
  
  var emitter = new events.EventEmitter()
  zehnder.comfoAir = Object.create(emitter)

  zehnder.comfoAir.discover = function(cb) {
    return discover.call(zehnder, cb);
  }

  zehnder.comfoAir.connect = function() {
    return connect.call(zehnder);
  }

  zehnder.comfoAir.disconnect = function() {
    return disconnect.call(zehnder);
  }

  zehnder.comfoAir.read_message = function(cb) {
    return read_message.call(zehnder, cb);
  }

  zehnder.comfoAir.write_message = function(cb) {
    return write_message.call(zehnder, cb);
  }

  Object.defineProperty(zehnder.comfoAir, 'options', {
    get options () { return zehnder.options },
    set options (v) { zehnder.options = v}  
  }); 
  
  return zehnder;
}
*/

/*
var parseOptions = function (options) {

  if (typeof options.port === 'undefined') {
    options.port = 56747;
  }

  if (typeof options.localUuid === 'undefined') {
    options.localUuid = Buffer.from('00000000000000000000000000000005', 'hex')
  }
 
  return options;
}
*/

/*
var discover = function (cb) {
  var zehnder = this;

  udpClient = udp.createSocket('udp4');

  udpClient.on('listening', function() { 
    if (zehnder.options.host == null) {
      udpClient.setBroadcast(true);
      udpClient.setMulticastTTL(128);
      udpClient.addMembership('10.81.5.63', ip.address());

      udpClient.send(Buffer.from('0a00', 'hex'), zehnder.options.port, null);
    } else {
      udpClient.send(Buffer.from('0a00', 'hex'), zehnder.options.port, zehnder.options.host);
    }
  });

  udpClient.on('message', function(message, remote) {
    console.log('recv: (' + remote.address + ':' + remote.port +  ') : ' + message.toString('hex'));

    // RECV : 12200a0a31302e38312e352e3631121000000000000910138001144fd71e13cb1801
    // UUID :                                 00000000000910138001144fd71e13cb
     // let parseUdp = new parser()
     //   .skip(16)
     //   .string('uuid', {encoding: 'hex', length: 16});
      
     let protoData = protocol.DiscoveryOperation.decode(message);
     zehnder.options.host = protoData.searchGatewayResponse.ipaddress;
     zehnder.options.comfoUuid = protoData.searchGatewayResponse.uuid;

      udpClient.close();

      cb.apply(zehnder.comfoAir);
  })

  udpClient.bind(zehnder.options.port);
  
}
*/

/*
var connect = function() {
  var zehnder = this;

  tcpClient = tcp.createConnection({port: zehnder.options.port, host: zehnder.options.host});

  tcpClient.on('connect', function () {
    zehnder.options.isConnected = true;
    console.info('disconnected from comfoAir unit');
  });
  tcpClient.on('data', read_message);
}

var disconnect = function() {
  var zehnder = this;

  tcpClient.disconnect();

  zehnder.options.isConnected = false;
  console.info('disconnected from comfoAir unit');
}

var read_message = function (data) {

}

var write_message = function (data) {

}
 */





    
