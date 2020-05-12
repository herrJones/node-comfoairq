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
      'debug'    : false
    };

    this.emitevents = true;
    this.opensession = false;
    this.othersession = false;

    this.rxdata = [];
    this.txdata = [];

    this._bridge = new comfoBridge(this._settings);

    this._bridge.on('received', (data) => {
      try {
        data.msg = after.cmd_GatewayOperation(data.data);
        data.result = after.cmd_DecodeMessage(data.msg);
        data.error = data.msg.result;
        data.kind = data.msg.type;
      }
      catch (exc) {
        console.log('onreceive error : ' + exc);
        this.emit('error', exc);
      }
      
      if (data.error == 'OTHER_SESSION') {
        console.log('onreceive : OTHER_SESSION detected --> disconnecting');
        this.othersession = true;
        this.opensession = false;

        let reason = {
          state: 'OTHER_SESSION'
        }
        this.emit('disconnect', reason)
      }

      if (!this._settings.debug) {
        delete data.data;
        delete data.msg;
      }

      //if (data.result.kind == 'CnRpdoNotification') {
      //  data.result.data = after.analyze_CnRpdoNotification(data.result.data);
      //}
      if (data.kind == 40) {
        data.result.data = after.analyze_CnRpdoNotification(data.result.data);
        this.emit('receive', data);

        return
      } else if (data.kind == 32) {
        this.emit('receive', data);

        return
      }

      if (this.emitevents) {
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
      if (this.opensession) {
        this.othersession = true;
        reason.state = 'OTHER_SESSION';
        console.log('bridge: OTHER_SESSION');
      }
      console.log('bridge: DISCONNECTED');
      this.opensession = false;

      this.emit('disconnect', reason);
    })
    
  }

  get settings() {
    return this._settings;
  }
  set settings(value) {
    this._settings = value;

    // copy some values through to the bridge settings
    let settings = this._bridge.settings;
    settings.debug = value.debug;
    this._bridge.settings = settings;
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

      do {
        let element = this.rxdata.shift();
        result.push(element);
      } while (this.rxdata.length > 0);
      
      resolve(result);
    }
    catch (exc) {
      reject(exc);
    }
    
  })

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
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_StartSession(force);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          await sleep(100);
          
          return result;
        }).then((result) => {
          resolve(result);

          this.opensession = true;
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });

    }
    catch (exc) {
      this.emitevents = true;
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
        })
        .catch((reason) => {
          reject(reason);
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
          this.opensession = false;
          resolve({});
        }).catch((reason) => {
          reject(reason);
        });
    }
    catch (exc) {
      reject(exc);
    }
  });
}

ComfoAirQ.prototype.ListRegisteredApps = function() {
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_ListRegisteredApps();

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });
      
    }
    catch (exc) {
      this.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.RegisterApp = function () {
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterApp(this._settings, true);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          resolve(result);
        }).then(() => {
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });
      
    }
    catch (exc) {
      this.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.DeRegisterApp = function (uuid) {
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_DeRegisterApp(uuid);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          await sleep(100);
          
          return result;
        }).then((result) => {
          resolve(result);
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });
      
    }
    catch (exc) {
      this.emitevents = true;
      reject(exc);

    }
  });
}

ComfoAirQ.prototype.RegisterSensor = function (sensor) {
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_RegisterSensor(sensor);

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          await sleep(100);

          return result;
        }).then((result) => {
          resolve(result);
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });
      
    }
    catch (exc) {
      this.emitevents = true;
      reject(exc);

    }
  });
  
}

ComfoAirQ.prototype.VersionRequest = async function () {
  this.emitevents = false;

  return new Promise((resolve, reject) => {
      
    try {
      let txData = before.cmd_VersionRequest();

      this._bridge.transmit(txData)
        .then(async () => {
          let result = await this._receive();
          await sleep(100);

          return result;
        }).then((result) => {
          resolve(result);
          this.emitevents = true;
        }).catch((reason) => {
          reject(reason);
        });
      
    }
    catch (exc) {
      this.emitevents = true;
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

