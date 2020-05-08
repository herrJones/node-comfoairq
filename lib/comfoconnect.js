'use strict'

const debug = require('debug')('comfoconnect');
const Buffer = require('safe-buffer').Buffer;
const events = require('events');


var comfoIP = '10.0.0.14'
var comfoPin = 4321

var localUUID = Buffer.from('20200428000000000000000009080407', 'hex')
var comfoDevice = 'node-comfoairq'

const comfoBridge = require('./bridge');
const before = require('./preparation')
const after = require('./analysis')
/*
var comfoOptions = {
    'host'      : comfoIP,
    'multicast' : '10.81.1.255', 
    'pin'       : comfoPin,
    'uuid' : localUUID,
    'comfoUuid' : '',
    'debug': true
}
*/
var comfoOptions = {
  'pin'      : comfoPin,
  'uuid'     : localUUID,
  'device'   : comfoDevice,
  'multicast': '10.81.1.255', 
  'comfoair' : comfoIP,
  'debug'    : false
}

// run a specific discovery of the comfoair device
function discoverBridge () {
  return new Promise(async (resolve, reject) => {
    try {
      comfoBridge.discover(comfoOptions, (options) => {
        console.log('comfoIP   : ' + options.comfoair + ':' + options.port);
        console.log('comfoUUID : ' + options.comfoUuid.toString('hex'));
        console.log('localUUID : ' + options.uuid.toString('hex'));
    
        // copy back in case of a broadcast
        comfoOptions.comfoair = options.comfoair;
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

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);

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

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);

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
      let txData = before.cmd_RegisterApp(comfoOptions, true);

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);
      let result = comfoBridge.receiveBuffer(comfoOptions.debug);
      resolve(result);

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

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);

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

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);

      resolve();

    }
    catch (exc) {
      reject(exc);
    }
  });
  
}

function getVersion() {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_VersionRequest();

      comfoBridge.sendBuffer(comfoOptions, txData, comfoOptions.debug);

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
      let rxData = await comfoBridge.receiveBuffer(comfoOptions.debug);

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
      } else {
        resolve(result);
      }
    }
  })
}

module.exports = {
  options: comfoOptions,
  bridge: comfoBridge,

  discover : discoverBridge,

  connect : connectDevice,
  keepalive: keepAlive,
  disconnect : disconnectDevice,
  
  version: getVersion,
  sensors: registerSensor,

  listapps : listRegisteredApps,
  register: registerApp,
  unregister: unregisterApp,

  receive: getResponse
}

