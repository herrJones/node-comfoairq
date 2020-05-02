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
    'multicast' : '10.81.1.255', 
    'pin'       : comfoPin,
    'localUuid' : localUUID,
    'comfoUuid' : ''
}

// run a specific discovery of the comfoair device
function discoverBridge () {
  return new Promise(async (resolve, reject) => {
    try {
      comfoBridge.discover(comfoOptions, (options) => {
        console.log('comfoIP   : ' + options.host + ':' + options.port);
        console.log('comfoUUID : ' + options.comfoUuid.toString('hex'));
        console.log('localUUID : ' + options.localUuid.toString('hex'));
    
        comfoOptions.host = options.host;
        comfoOptions.comfoUuid = options.comfoUuid;

        resolve(comfoOptions);
      });
    }
    catch (exc) {
      reject(exc);
    }
  });
}

function connectDevice(force) {

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_StartSession(force);

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
}

function keepAlive() {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_KeepAlive();

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });

}

function disconnectDevice() {

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_CloseSession();

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
}

function listRegisteredApps() {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_ListRegisteredApps();

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
  
}

function registerApp() {

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterApp(localUUID, comfoPin, comfoDevice);

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
  
}

function unregisterApp(uuid) {

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_DeRegisterApp(uuid);

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
}

function registerSensor(sensor) {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterSensor(sensor);

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
  
}

/*
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
*/

function getVersion() {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_VersionRequest();

      comfoBridge.sendBuffer(comfoOptions, txData);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
  
}

async function getResponse() {
  return new Promise(async (resolve, reject) => {
    let result = {};
    try {
      let rxData = await comfoBridge.receiveBuffer(true);
      //if (rxData != null) {
      result = after.cmd_DecodeMessage(rxData.msg);
      
      if (result.error != 'OK') {
        throw new Error(result.error);
      }

      if (result.kind == 'CnRpdoNotification') {
        result.data = after.analyze_CnRpdoNotification(result.data);
      }
      resolve(result);
    }
    catch (exc) {
      if (!exc.message.includes('timeout')) {
        reject(exc);
      }
    }
  })
}

module.exports = {
  discover : discoverBridge,
  connect : connectDevice,
  disconnect : disconnectDevice,
  listapps : listRegisteredApps,
  version: getVersion,
  sensors: registerSensor,
  //notifies: sensorNotification,
  keepalive: keepAlive,
  register: registerApp,
  unregister: unregisterApp,
  receive: getResponse
}

