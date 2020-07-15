'use strict';

const debug = require('debug')('node-zehnder');
const Buffer = require('safe-buffer').Buffer;
//const fs = require('fs');
//const protoBuf = require('protocol-buffers');
//const messages = protoBuf(fs.readFileSync(__dirname + '/protocol/zehnder.proto'));
const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const statics = require('./const');

let reference = 1;

function cmd_ListRegisteredApps(debug = false) {

  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.ListRegisteredAppsRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();
  
  const command = messages.lookupType('ListRegisteredAppsRequest');
  data = command.create({});
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }
  
  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };

}

function cmd_KeepAlive() {

  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.KeepAliveType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('KeepAlive');
  data = command.create({});
  const cmdBuffer = command.encode(data).finish();
  
  //if (debug) {
  //  console.log(" ** " + opBuffer.toString("hex") + " - " + cmdBuffer.toString("hex"));
  //}

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };

}

// PY : 0000004a2020042800000000000000000102030400000000000910138001144fd71e13cb0004080220020a102020042800000000000000000102030410a6371a0d6465762d636f6d666f61697271
// JS : 0000004a2020042800000000000000000908040700000000000910138001144fd71e13cb0004080220010a102020042800000000000000000102030410a6371a0d6465762d636f6d666f61697271 
function cmd_RegisterApp(options, debug = false) {

  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type: messages.GatewayOperation.OperationType.RegisterAppRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();
  

  const command = messages.lookupType('RegisterAppRequest');
  const uuidBuffer = Buffer.from(options.uuid, 'hex');

  data = command.create({
    uuid: uuidBuffer.toString('base64'),
    pin: options.pin,
    devicename : options.device
  });
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log('  register app : ' + JSON.stringify(data));

    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };
}

// PY : 000000383020042800000000000000000102030400000000000910138001144fd71e13cb0004080620060a1020200428000000000000000001020304
// JS : 000000282020042800000000000000000908040700000000000910138001144fd71e13cb0004080620020a00
function cmd_DeRegisterApp(uuid, debug = false) {

  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.DeregisterAppRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('DeregisterAppRequest');
  data = command.create({
    uuid: uuid
  });
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };
}

function cmd_StartSession(takeover, debug = false) {
  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.StartSessionRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('StartSessionRequest');
  data = command.create({
    takeover: takeover
  });
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };

}

function cmd_RegisterSensor(sensor, debug = false) {
  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CnRpdoRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('CnRpdoRequest');
  const sensorData = statics.sensorCodes.find( ({ code }) => code === sensor);
  data = command.create({
    pdid: sensor,
    type: sensorData.kind
  });
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };
}

function cmd_SendCommand(node, message) {
  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CnRmiRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('CnRmiRequest');
  const msgData = statics.comfoCommands.find( ({ name }) => name === message);
  const cmdData = {
    nodeId: node,
    message: Buffer.from(msgData.code, 'hex')
  };
  const reason = command.verify(cmdData);
  if (reason != null) {
    console.log(reason);
  }
  data = command.create({
    nodeId: node,
    message: Buffer.from(msgData.code, 'hex')
  });
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + message + ' - ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  } else {
    console.log(' ** ' + message);
  }

  return {
    'operation': opBuffer,
    'command'  : cmdBuffer
  };
  
}

function cmd_CloseSession(debug = false) {
  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.CloseSessionRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('CloseSessionRequest');
  data = command.create({});
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command':cmdBuffer
  };
}

function cmd_VersionRequest(debug = false) {
  const operation = messages.lookupType('GatewayOperation');
  let data = operation.create({
    type : messages.GatewayOperation.OperationType.VersionRequestType,
    reference : reference++
  });
  const opBuffer = operation.encode(data).finish();

  const command = messages.lookupType('VersionRequest');
  data = command.create({});
  const cmdBuffer = command.encode(data).finish();

  if (debug) {
    console.log(' ** ' + opBuffer.toString('hex') + ' - ' + cmdBuffer.toString('hex'));
  }

  return {
    'operation': opBuffer,
    'command':cmdBuffer
  };
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
};

