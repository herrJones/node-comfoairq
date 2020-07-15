'use strict';

const debug = require('debug')('node-zehnder');
const Buffer = require('safe-buffer').Buffer;

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const statics = require('./const');

function cmd_GatewayOperation(data) {
  const message = {};
  try {
    const cmd_len = data.readInt16BE(36);
    message.operation = data.slice(38, 38 + cmd_len);
    message.command = data.slice(38 + cmd_len);

    const operation = messages.lookupType('GatewayOperation').decode(message.operation);
    message.reference = operation.reference;
    message.type = operation.type;

    switch (operation.result) {
      case messages.GatewayOperation.GatewayResult.OK:
        message.result = 'OK';
        break;

      case messages.GatewayOperation.GatewayResult.BAD_REQUEST:
        message.result = 'BAD_REQUEST';
        break;

      case messages.GatewayOperation.GatewayResult.INTERNAL_ERROR:
        message.result = 'INTERNAL_ERROR';
        break;

      case messages.GatewayOperation.GatewayResult.NOT_REACHABLE:
        message.result = 'NOT_REACHABLE';
        break;

      case messages.GatewayOperation.GatewayResult.OTHER_SESSION:
        message.result = 'OTHER_SESSION';
        break;

      case messages.GatewayOperation.GatewayResult.NOT_ALLOWED:
        message.result = 'NOT_ALLOWED';
        break;

      case messages.GatewayOperation.GatewayResult.NO_RESOURCES:
        message.result = 'NO_RESOURCES';
        break;

      case messages.GatewayOperation.GatewayResult.NOT_EXIST:
        message.result = 'NOT_EXIST';
        break;

      case messages.GatewayOperation.GatewayResult.RMI_ERROR:
        message.result = 'RMI_ERROR';
        break;
    
      default:
        message.result = 'UNKNOWN';
        break;
    }
  } catch (error) {
    console.log(error + ' --> data = ' + data.toString('hex'));
  }

  return message;
}

function cmd_DecodeMessage(message) {
  const result = {
    error: '',
    kind: '',
    data: ''
  };

  try {
    
    const msgType = statics.msgCodes.find( ({ code }) => code === message.type);

    if (message.result == 'OK') {
      const command = messages.lookupType(msgType.name);
      result.kind = msgType.name;
      result.data = command.decode(message.command);

      if (result.kind == 'CloseSessionRequest') {
        result.error = 'OTHER_SESSION';
      } else {
        result.error = 'OK';
      }
      
    } else {
      result.error = message.result;
    }
  } catch (error) {
    console.log(error + ' - ' + JSON.stringify(message));
    result.error = error;
  }

  return result;
}

function analyze_CnRpdoNotification(data) {
  const sensorData = statics.sensorCodes.find( ({ code }) => code === data.pdid);
  const binVal = Buffer.from(data.data, 'base64');
  let value = null;

  switch (sensorData.kind) {
    case 1 : 
      value = binVal.readInt8(0);
      break;
    case 2 :
      value = binVal.readInt16LE(0);
      break;
    case 6 : 
      value = binVal.readInt16LE(0) / 10;
      break;
    default:
      value = binVal;
      
  }


  return {
    'pdid': data.pdid,
    'name': sensorData.name,
    'data': value
  };
}

module.exports = {
  cmd_GatewayOperation,
  cmd_DecodeMessage,
  analyze_CnRpdoNotification
};