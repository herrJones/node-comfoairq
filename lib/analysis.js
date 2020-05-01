'use strict'

const debug = require('debug')('node-zehnder')
const Buffer = require('safe-buffer').Buffer;

const protoBuf = require('protobufjs');
const messages = protoBuf.loadSync(__dirname + '/protocol/zehnder.proto');
const statics = require('./const');

function cmd_GatewayOperation(data) {
  let message = {}
  try {
    let cmd_len = data.readInt16BE(36);
    message.operation = data.slice(38, 38 + cmd_len);
    message.command = data.slice(38 + cmd_len);

    let operation = messages.lookupType('GatewayOperation').decode(message.operation);
    message.reference = operation.reference;
    message.type = operation.type;

    switch (operation.result) {
      case messages.GatewayOperation.GatewayResult.OK:
        message.result = 'OK'
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
    console.log(error + ' --> data = ' + data.toString("hex"));
  }

  return message;
}
/*
const msgCodes = [
  {code: 39, name: 'CnRpdoConfirm'},
  {code: 40, name: 'CnRpdoNotification'},
  {code: 52, name: 'RegisterAppConfirm'},
  {code: 53, name: 'StartSessionConfirm'},
  {code: 54, name: 'CloseSessionConfirm'},
  {code: 55, name: 'ListRegisteredAppsConfirm'},
  {code: 56, name: 'DeregisterAppConfirm'},
  {code: 68, name: 'VersionConfirm'},
  {code:100, name: 'GatewayNotification'}
]
*/

function cmd_DecodeMessage(message) {
  let result = {};

  try {
    if (message == null) {
      return result;
    }
    
    let msgType = statics.msgCodes.find( ({ code }) => code === message.type);

    if (message.result == 'OK') {
      let command = messages.lookupType(msgType.name);
      result = command.decode(message.command);
      result.error = 'OK';
    } else {
      result.error = message.result;
    }
  } catch (error) {
    console.log(error);
    result.error = error;
  }

  return result;
}

module.exports = {
  cmd_GatewayOperation,
  cmd_DecodeMessage
}