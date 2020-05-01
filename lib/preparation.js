'use strict'

const debug = require('debug')('node-comfoairq')
const Buffer = require('safe-buffer').Buffer;

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const statics = require('./const');

var reference = 1;

function bufferToBase64(buf) {
  var binstr = Array.prototype.map.call(buf, function (ch) {
      return String.fromCharCode(ch);
  }).join('');
  return btoa(binstr);
}

function cmd_ListRegisteredApps() {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.ListRegisteredAppsRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();
  
  let command = messages.lookupType('ListRegisteredAppsRequest')
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }

}

function cmd_KeepAlive() {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.KeepAliveType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('KeepAlive');
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  //console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }

}

function cmd_RegisterApp(uuid, pin, devicename) {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.RegisterAppRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();
  

  let command = messages.lookupType('RegisterAppRequest');
  data = command.create({
    uuid: uuid.toString('base64'),
    pin: pin,
    devicename : devicename
  });
  let cmdBuffer = command.encode(data).finish();

  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}

function cmd_DeRegisterApp(uuid) {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.DeregisterAppRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('DeregisterAppRequest');
  data = command.create({
    uuid: uuid
  });
  let cmdBuffer = command.encode(data).finish();

  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}

function cmd_StartSession(takeover) {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.StartSessionRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('StartSessionRequest');
  data = command.create({
    takeover: takeover
  });
  let cmdBuffer = command.encode(data).finish();

  //console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }

}

function cmd_RegisterSensor(sensor) {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CnRpdoRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('CnRpdoRequest');
  let sensorData = statics.sensorCodes.find( ({ code }) => code === sensor);
  data = command.create({
    pdid: sensor,
    type: sensorData.kind
  });
  let cmdBuffer = command.encode(data).finish();

  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}


function cmd_CloseSession() {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CloseSessionRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('CloseSessionRequest');
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command':cmdBuffer
  }
}

function cmd_VersionRequest() {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.VersionRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('VersionRequest')
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //return Buffer.concat([opBuffer, cmdBuffer]);
  return {
    'operation': opBuffer,
    'command':cmdBuffer
  }
}

module.exports = {
  cmd_ListRegisteredApps,
  cmd_KeepAlive,
  cmd_RegisterApp,
  cmd_DeRegisterApp,
  cmd_StartSession,
  cmd_RegisterSensor,
  cmd_CloseSession,
  cmd_VersionRequest
}

