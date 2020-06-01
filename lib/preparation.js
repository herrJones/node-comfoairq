'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;
//const fs = require('fs');
//const protoBuf = require('protocol-buffers');
//const messages = protoBuf(fs.readFileSync(__dirname + '/protocol/zehnder.proto'));
const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const statics = require('./const');

var reference = 1;

function cmd_ListRegisteredApps(debug = false) {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.ListRegisteredAppsRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();
  
  let command = messages.lookupType('ListRegisteredAppsRequest')
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }
  
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
  
  //if (debug) {
  //  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //}

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }

}

function cmd_RegisterApp(options, debug = false) {

  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.RegisterAppRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();
  

  let command = messages.lookupType('RegisterAppRequest');
  data = command.create({
    uuid: options.uuid.toString('base64'),
    pin: options.pin,
    devicename : options.device
  });
  let cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}

function cmd_DeRegisterApp(uuid, debug = false) {

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

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}

function cmd_StartSession(takeover, debug = false) {
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

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }

}

function cmd_RegisterSensor(sensor, debug = false) {
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

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
}

function cmd_SendCommand(node, message) {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CnRmiRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('CnRmiRequest');
  let msgData = statics.comfoCommands.find( ({ name }) => name === message);
  let cmdData = {
    nodeId: node,
    message: Buffer.from(msgData.code, 'hex')
  };
  let reason = command.verify(cmdData);
  if (reason != null) {
    console.log(reason)
  }
  data = command.create({
    nodeId: node,
    message: Buffer.from(msgData.code, 'hex')
  });
  let cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(" ** " + message + " - " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  } else {
    console.log(" ** " + message)
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  }
  
}

function cmd_CloseSession(debug = false) {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CloseSessionRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('CloseSessionRequest');
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

  return {
    'operation': opBuffer,
    'command':cmdBuffer
  }
}

function cmd_VersionRequest(debug = false) {
  let operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.VersionRequestType,
    reference : reference++
  });
  let opBuffer = operation.encode(data).finish();

  let command = messages.lookupType('VersionRequest')
  data = command.create({});
  let cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  }

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
  cmd_SendCommand,
  cmd_CloseSession,
  cmd_VersionRequest
}

