'use strict'

const debug = require('debug')('comfoconnect');
//var net = require('net');
//var events = require('events');
const Buffer = require('safe-buffer').Buffer;


var comfoIP = '10.0.0.14'
var comfoPin = 4321

var localUUID = Buffer.from('20200428000000000000000009080407', 'hex')
var comfoDevice = 'nodeComfoConnect'

const comfoBridge = require('./bridge');
const before = require('./preparation')
const after = require('./analysis')

var comfoOptions = {
    'host'      : comfoIP,
    'multicast' : '10.0.0.255', 
    'pin'       : comfoPin,
    'localUuid' : localUUID,
    'comfoUuid' : ''
}

function discoverBridge () {
  comfoBridge.discover(comfoOptions, (options) => {
    console.log('comfoIP   : ' + options.host + ':' + options.port);
    console.log('comfoUUID : ' + options.comfoUuid.toString('hex'));
    console.log('localUUID : ' + options.localUuid.toString('hex'));

    comfoOptions.host = options.host;
    comfoOptions.comfoUuid = options.comfoUuid;
  });
}

async function connectDevice(force, callback) {
  let txData = before.cmd_StartSession(force);
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer(true);

    //result = after.cmd_StartSession(rxData);
    result = after.cmd_DecodeMessage(rxData.msg);

    if (result.error != 'OK') {
      console.warn('connect reply = ' + result.error);
    }
  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
}

async function disconnectDevice(callback) {
  let txData = before.cmd_CloseSession();
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    //let rxData = await comfoBridge.receiveBuffer(true);

    //result = after.cmd_CloseSession(rxData);
    //result = after.cmd_DecodeMessage(rxData.msg)
  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
}

async function keepAlive(callback) {
  let txData = before.cmd_KeepAlive();
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    //let rxData = await comfoBridge.receiveBuffer();

    //result = after.cmd_CloseSession(rxData);
    //console.log('RX : ' + result.toString('hex'));
  } catch (error) {
    if (!error.includes('passed')) {
      console.log(error)
    }
  } 
  finally {
    callback(result); 
  }
}

async function listRegisteredApps(callback) {
  let txData = before.cmd_ListRegisteredApps();
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer(true);

    //result = after.cmd_ListRegisteredApps(rxData.msg);
    result = after.cmd_DecodeMessage(rxData.msg)
    //console.log('RX : ' + result.toString('hex'));
  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
  
}

async function registerApp(callback) {
  let txData = before.cmd_RegisterApp(localUUID, comfoPin, comfoDevice);
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer();

    result = after.cmd_DecodeMessage(rxData.msg)
  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
  
}

async function unregisterApp(uuid, callback) {

  let txData = before.cmd_DeRegisterApp(uuid);
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer(true);

    result = after.cmd_DecodeMessage(rxData.msg)
  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
}

async function registerSensor(sensor, callback) {
  let txData = before.cmd_RegisterSensor(sensor);
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer(true);

    //result = after.cmd_registerSensor(rxData);
    result = after.cmd_DecodeMessage(rxData.msg);

    //if (result.error !== '') {
    //  throw result.error
    //}
      
    //console.log('RX : ' + result.toString('hex'));
  } catch (error) {
    console.log(error)
    throw error
  } finally {
    callback(result); 
  }
}

async function sensorNotification(callback) {
  let result = {};

  try {
    let rxData = await comfoBridge.receiveBuffer(true);
    if (rxData != null) {
      result = after.cmd_DecodeMessage(rxData.msg);
    }
  } catch (error) {
    if (!error.includes('passed')) {
      console.log(error);
    }
    
  } finally {
    callback(result); 
  }

}

async function getComfoVersion(callback) {
  let txData = before.cmd_VersionRequest();
  let result = {};

  try {
    comfoBridge.sendBuffer(comfoOptions, txData);
    let rxData = await comfoBridge.receiveBuffer(true);

    result = after.cmd_DecodeMessage(rxData.msg);

  } catch (error) {
    console.log(error)
  } 
  finally {
    callback(result); 
  }
  
}

module.exports = {
  discover : discoverBridge,
  connect : connectDevice,
  disconnect : disconnectDevice,
  listapps : listRegisteredApps,
  version: getComfoVersion,
  sensors: registerSensor,
  notifies: sensorNotification,
  keepalive: keepAlive,
  register: registerApp,
  unregister: unregisterApp
}

