'use strict'

const debug = require('debug')('comfoconnect');
const Buffer = require('safe-buffer').Buffer;
const events = require('events');
//const emitter = new events.EventEmitter;

var comfoIP = '10.0.0.14'
var comfoPin = 4321

var localUUID = Buffer.from('20200428000000000000000009080407', 'hex')
var comfoDevice = 'node-comfoairq'

const comfoBridge = require('./bridge');
const before = require('./preparation')
const after = require('./analysis')
 
class ComfoAirQ extends events {
  constructor () {
    super();

    this._settings = {
      'pin'      : comfoPin,
      'uuid'     : localUUID,
      'device'   : comfoDevice,
      'multicast': '10.0.0.255', 
      'port'     : 56747,
      'comfoair' : comfoIP,
      'debug'    : false,
      'verbose'  : false,
      'keepalive': 15000
    };
    this._status = {
      'connected' : false,
      'reconnect' : false,
      'emitevents': false
    }

    this.rxdata = [];                       // array of received messages for 'manual' receive operations
    this.txdata = [];                       // array of messages to transmit

    this.nodes = [];
    this.sensors = [];

    this._bridge = new comfoBridge(this._settings);

    this._bridge.on('received', (data) => {
      data.msg = after.cmd_GatewayOperation(data.data);
      data.result = after.cmd_DecodeMessage(data.msg)
      data.error = data.msg.result;
      data.kind = data.msg.type;

      if (!this._settings.verbose) {
        delete data.data;
        delete data.msg;
      }

      if (data.kind == 40) {  // CnRpdoNotification
        data.result.data = after.analyze_CnRpdoNotification(data.result.data);
      } else if (data.kind == 32) {
        // TODO
      } else if (data.kind == 54) {
        let reason = {
          state: 'OTHER_SESSION'
        }
        this.emit('disconnect', reason);
      }

      if (this._status.emitevents) {
        this.emit('receive', data);
      } else {
        this.rxdata.push(data);
      }
      
    });
    this._bridge.on('error', (reason) => {
      try {
        console.log('bridge: ' + reason);
      }
      catch (exc) {
        console.log('bridge: ' + JSON.stringify(reason));
        console.log('    **: ' + exc);
      }
      
    });
    this._bridge.on('disconnect', () => {
      let reason = {
        state: 'DISC'
      }
      //if (this._status.connected && this._status.reconnect) {
      //  //this.othersession = true;
      //  //reason.state = 'OTHER_SESSION';
      //  console.log('bridge: OTHER_SESSION');
      //}
      console.log('bridge: DISCONNECTED');
      this._status.connected = false;

      this.emit('disconnect', reason);
    })
    
  }

  get settings() {
    return this._settings;
  }
  set settings(value) {
    
    if (value.keepalive == null) {
      value.keepalive = 15000;
    }
    this._settings = value;

    // copy some values through to the bridge settings
    let settings = this._bridge.settings;
    settings.debug = value.debug;
    this._bridge.settings = settings;

  }

  get status() {
    return this._status;
  }
  set status(value) {
    this._status = value;
  }

}

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

ComfoAirQ.prototype._receive = async function () {
  let timeout = 25;

  while (this.rxdata.length == 0) {
    await sleep(50);
    if (timeout-- == 0) {
      break;
    }
  }

  return new Promise((resolve, reject) => {
    
    let result = []
    try {
      if (timeout <= 0) {
        throw new Error('timeout');
      }
      this.rxdata.forEach(element => {
        result.push(element);
      });
      resolve(result);
    }
    catch (exc) {
      reject(exc);
    }
    
  })

}

ComfoAirQ.prototype._keepalive = async function () {

  if (!this._status.connected) {
    if (this._status.reconnect) {
      setTimeout(this._reconnect.bind(this), this._settings.keepalive)
    }
    return;
  }
  this.KeepAlive()
    .catch((reason) => {
      console.log('error sending KeepAlive: ' + reason);
    })
  setTimeout(this._keepalive.bind(this), this._settings.keepalive)
}

ComfoAirQ.prototype._reconnect = function () {

  this.StartSession(false)
    .then((data) => {
      let idx = 0;
      while (data[idx].kind != 53) {    // StartSessionConfirmType
        idx++;
      }
      if (this._settings.verbose) {
        console.log('reconnect: ' + JSON.stringify(data[idx]));
      }
      if (data[idx].error == 'OTHER_SESSION') {
        //throw 'other session still active'
        setTimeout(this._reconnect.bind(this), this._settings.keepalive)
        return false
      }

      //let everythingOK = false;
      this.sensors.forEach(async sensor => {
        
        let result = await this.RegisterSensor(sensor);
        let test = Array.isArray(result);

        if (test) {
          while (result[idx].kind != 39) {    // CnRpdoConfirmType
            idx++;
          }
          if (idx >= result.length) {
            return false;
          }
          if (result[idx].error != 'OK') {
            return false;
          }
        } else {
          if (result.error != 'OK') {
            return false
          }
        }
      });
      return true;

    })
    .then((everythingOK) => {
      if (everythingOK) {
        setTimeout(this._keepalive.bind(this), this._settings.keepalive)
      } else {
        setTimeout(this._reconnect.bind(this), this._settings.keepalive)
      }
      
    })
    .catch((reason) => {
      console.log('reconnect failure : ' + reason);
      setTimeout(this._reconnect.bind(this), this._settings.keepalive)
    });
  
}

// run a specific discovery of the comfoair device
ComfoAirQ.prototype.discover = function () {
  return new Promise((resolve, reject) => {
    try {
      this._bridge.discover(this._settings, (options) => {
        console.log('comfoIP   : ' + options.comfoair + ':' + options.port);
        console.log('comfoUUID : ' + options.comfoUuid.toString('hex'));
        console.log('localUUID : ' + options.uuid.toString('hex'));
    
        // copy back in case of a broadcast
        this._settings.comfoair = options.comfoair;
        this._settings.comfoUuid = options.comfoUuid;

        resolve(this._settings);
      });
    }
    catch (exc) {
      reject(exc);
    }
  });
}

ComfoAirQ.prototype.StartSession = function (force) {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_StartSession(force);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
          
        }).then(() => {
          //this.opensession = true;

          setTimeout(this._keepalive.bind(this), this._status.keepalive);

          this._status.connected = true;
          this._status.reconnect = true;
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      this.opensession = false;
      reject(exc);

    }
  });
}

ComfoAirQ.prototype.KeepAlive = function () {
  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_KeepAlive();

      this._bridge.transmit(txData)
        .then(() => {
          resolve({});
        });

    }
    catch (exc) {
      reject(exc);
    }
  });

}

ComfoAirQ.prototype.CloseSession = function () {

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_CloseSession();

      this._bridge.transmit(txData)
        .then(() => {
          this._status.reconnect = false;
          this.sensors = [];
          resolve({});
        });
    }
    catch (exc) {
      reject(exc);
    }
  });
}

ComfoAirQ.prototype.ListRegisteredApps = function() {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_ListRegisteredApps();

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.RegisterApp = function () {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterApp(this._settings, true);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.DeRegisterApp = function (uuid) {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_DeRegisterApp(uuid);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
}

ComfoAirQ.prototype.RegisterSensor = function (sensor) {
  this._status.emitevents = false;

  let idx = this.sensors.indexOf(sensor);
  if (idx == -1) {
    this.sensors.push(sensor);
  }

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterSensor(sensor);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.SendCommand = function (node, message) {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_SendCommand(node, message);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
}

ComfoAirQ.prototype.VersionRequest = async function () {
  this._status.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_VersionRequest();

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this._status.emitevents = true;
        })
      
    }
    catch (exc) {
      this._status.emitevents = true;
      reject(exc);

    }
  });
  
}

/*
async function getResponse() {
  return new Promise(async (resolve, reject) => {

}
*/

module.exports = ComfoAirQ; 

