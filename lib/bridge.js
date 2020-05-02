'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;
const udp = require('dgram');
var tcp = require('net');

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const after = require('./analysis')

var bridge = null;

class zehnderBridge {

  constructor (options) {
    if (typeof options.port === 'undefined') {
      options.port = 56747;
    } 
  
    //if (typeof options.uuid === 'undefined') {
    //  options.uuid = Buffer.from('00000000000000000000000000000005', 'hex')
    //} 

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

    })

    this.sock.on('close', (had_error) => {
      if (had_error) {
        console.log("TCP socket closed with error");
      } else {
        console.log("TCP socket closed");
      }

      this.connected = false;
    })
    this.sock.on('end', () => {
      console.log("TCP socket ended");

      this.connected = false;
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

  async sendBuffer(txdata) {
    let comfo = this;

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
        comfo.sock.connect(comfo.options.port, comfo.options.comfoair, () => {
          console.log('connected to comfoAir unit');

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

  // the bridge must exist.
  // if not: run discovery first
  if (bridge == null) {
    bridge = new zehnderBridge(options);

    await bridge.discovery();
  }

  try {

    // create the datastream to transmit
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
