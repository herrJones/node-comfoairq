'use strict';

const debug = require('debug')('comfoconnect');
const debugVerbose = require('debug')('comfoconnect:details');
//const debugRaw = require('debug')('comfoconnect:raw-data');
const debugError = require('debug')('comfoconnect:error');

const Buffer = require('safe-buffer').Buffer;
const events = require('events');

const comfoBridge = require('./bridge');
const before = require('./preparation');
const after = require('./analysis');
const config = require('./const');
 
class ComfoAirQ extends events {
  constructor(options) {
    super();

    this._settings = {
      'pin'      : options.pin,
      'uuid'     : Buffer.from(options.uuid, 'hex'),
      'device'   : options.device,
      'comfoair' : options.comfoair,
      'multicast': options.multicast, 
      'port'     : 56747,
      
      'debug'    : options.debug,
      'verbose'  : options.verbose,
      'keepalive': 15000
    };
    this._status = {
      'connected' : false,
      'reconnect' : false,
      'resume'    : false  
    };
    this._exec = {
      'keepalive': null,
      'reconnect': null
    };

    this.rxlist = [];                       // array of messages to receive

    this.nodes = [];
    this.sensors = [];

    this._bridge = new comfoBridge(this._settings);

    this._bridge.on('received', (data) => {
      data.msg = after.cmd_GatewayOperation(data.data);
      data.result = after.cmd_DecodeMessage(data.msg);
      data.error = data.msg.result;
      data.kind = data.msg.type;

      if (this.rxlist.length > 0) {
        const idx = this.rxlist.findIndex( ({ kind }) => kind === data.kind);
        if (idx >= 0) {
          this.rxlist.splice(idx);
        }
      }

      if (!this._settings.debug) {
        delete data.data;
        delete data.msg;
      }

      if (data.kind == 40) {           // CnRpdoNotification
        data.result.data = after.analyze_CnRpdoNotification(data.result.data);

      } else if (data.kind == 53) {    // StartSessionConfirm
        if (data.error == 'OK') {
          this._status.connected = true;

          if (data.result.data.resumed){
            debug(' StartSessionConfirm --> OK - resuming session');
            this._status.resume = true;
          } else {
            this._status.resume = false;
          }
        } else {
          debugVerbose(' StartSessionConfirm --> ' + data.error);
          this._status.connected = false;
        }
        this._status.reconnect = true;
      } else if (data.kind == 31) {    // CnTimeConfirmType
        debugVerbose(' CnTimeConfirm --> ' + data.error);
        data.result.data = after.analyze_CnTimeConfirm(data.result.data);
      
      } else if (data.kind == 32) {    // CnNodeNotificationType
        // TODO
        debugVerbose(' CnNodeNotification --> ' + data.error);
      } else if (data.kind == 52) {    // RegisterAppConfirmType
        debugVerbose(' RegisterAppConfirm --> ' + data.error);
      } else if (data.kind == 55) {    // ListRegisteredAppsConfirmType
        debugVerbose(' ListAppConfirm --> ' + data.error);
        data.result.data = after.analyze_ListRegisteredApps(data.result.data);
      } else if (data.kind == 4) {     // CloseSessionRequest
        const reason = {
          state: 'OTHER_SESSION'
        };
        this.emit('disconnect', reason);
      } 

      // push the received data to the calling program
      this.emit('receive', data);
      
    });
    this._bridge.on('error', (reason) => {
      try {
        debugError('comfo: ' + reason.error);
        this._status.connected = false;
      }
      catch (exc) {
        debugError('comfo: ' + JSON.stringify(reason) + ' - ' + exc);
      }
      
    });
    this._bridge.on('disconnect', () => {
      const reason = {
        state: 'DISC'
      };

      debug('comfo: DISCONNECTED -> ' + config.getTimestamp());
      this._status.connected = false;
      
      this.emit('disconnect', reason);
    });
    
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
    const settings = this._bridge.settings;
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

ComfoAirQ.prototype._keepalive = async function () {

  if (!this._status.connected) {
    if ((this._status.reconnect) && (this._exec.reconnect == null)) {
      this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive);
    }
    this._exec.keepalive = null;
    return;
  }

  if (this.rxlist.length > 0) {
    this.rxlist.forEach((element) => {
      const diff = Date.now() - element.timestamp;
      if (diff.valueOf() > this._settings.keepalive) {
        debugError('timout receiving: ' + JSON.stringify(element) + ' -> ' + config.getTimestamp());
      }
    });
  }

  this.KeepAlive()
    .then(() => {
      this._exec.keepalive = setTimeout(this._keepalive.bind(this), this._settings.keepalive);
      this._exec.reconnect = null;
    }, (reason) => {
      this._exec.keepalive = null;
      if (this._exec.reconnect == null) {
        this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive);
      }
      
      debugError('error sending KeepAlive: ' + reason + ' -> ' + config.getTimestamp());
    });

};

ComfoAirQ.prototype._reconnect = function () {

  if (this._status.connected) {
    return;
  }
  debug('** starting reconnection -> ' + config.getTimestamp()());
  this.StartSession(false)
    .then(() => {
      //if (!this._status.resume) {
      // re-register to all previously registered sensors
      this.sensors.forEach(async sensor => {
          
        const result = await this.RegisterSensor(sensor);
        if (this._settings.verbose) {
          debugVerbose('SENSID: ' + sensor.toString() + ' - ' + JSON.stringify(result));
        }
        await config.sleep(100); 
      });

      if (this._status.connected) {
        this._exec.keepalive = setTimeout(this._keepalive.bind(this), this._settings.keepalive);
        this._exec.reconnect = null;
      } else {
        this._exec.keepalive = null;
        this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive);
      }
      this._status.resume = false;
      
    }, (reason) => {
      this._status.connected = false;
      this._status.resume = false;
      debugError('reconnect failure : ' + reason);

      this._exec.keepalive = null;
      this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive);
    });
    
  
};

// run a specific discovery of the comfoair device
ComfoAirQ.prototype.discover = async function () {
  return new Promise((resolve, reject) => {
    try {
      this._bridge.discover(this._settings)
        .then(async (options) => {
          debugVerbose('comfoIP   : ' + options.device + ':' + options.port);
          debugVerbose('comfoUUID : ' + options.comfouuid.toString('hex'));
          debugVerbose('localUUID : ' + options.localuuid.toString('hex'));
      
          // copy back in case of a broadcast
          this._settings.comfoair = options.device;
          this._settings.comfouuid = options.comfouuid;
  
          resolve(this._settings);
        });
      /*
      await this._bridge.discover(this._settings, (options) => {
        console.log('comfoIP   : ' + options.device + ':' + options.port);
        console.log('comfoUUID : ' + options.comfouuid.toString('hex'));
        console.log('localUUID : ' + options.localuuid.toString('hex'));
    
        // copy back in case of a broadcast
        this._settings.comfoair = options.device;
        this._settings.comfouuid = options.comfouuid;

        resolve(this._settings);
      });
      */
    }
    catch (exc) {
      reject(exc);
    }
  });
};

ComfoAirQ.prototype.StartSession = function (force) {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_StartSession(force);
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 53
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          let cnt = 150;
          while (!this._bridge.isconnected) {
            await config.sleep(100);
          }

          while ((cnt-- > 0) && (!this._status.connected)) {
            await config.sleep(100);
          }

          if (cnt <= 0) {
            if (this._exec.reconnect == null) {
              this._exec.keepalive = null;
              this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._status.keepalive);
            }
            
            reject('timeout connecting (1)');
          } 
      
          if (this._status.connected) {
            if (this._exec.keepalive == null) {
              this._exec.keepalive = setTimeout(this._keepalive.bind(this), this._status.keepalive);
              this._exec.reconnect = null;
            }
            resolve({});
          } else {
            if (this._exec.reconnect == null) {
              this._exec.keepalive = null;
              this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._status.keepalive);
            }
            reject('timeout connecting (2)');
          }

        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      this.opensession = false;
      reject(exc);

    }
  });
};

ComfoAirQ.prototype.KeepAlive = function () {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_KeepAlive();

      this._bridge.transmit(txData)
        .then(() => {
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });

    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);
    }
  });

};

ComfoAirQ.prototype.CloseSession = function () {

  return new Promise((resolve, reject) => {
      
    if (!this._status.connected) {
      resolve({});
    }

    try {
      const txData = before.cmd_CloseSession();

      this._bridge.transmit(txData)
        .then(() => {
          
          clearTimeout(this._exec.keepalive);
          clearTimeout(this._exec.reconnect);        

          this._status.reconnect = false;
          this.sensors = [];
          debugVerbose('comfo : session closed -> ' + config.getTimestamp());
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);
    }
  });
};

ComfoAirQ.prototype.ListRegisteredApps = function() {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_ListRegisteredApps();
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 55
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
  
};

ComfoAirQ.prototype.RegisterApp = function () {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_RegisterApp(this._settings, true);
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 52
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
  
};

ComfoAirQ.prototype.DeRegisterApp = function (uuid) {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_DeRegisterApp(uuid);
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 56
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
};

ComfoAirQ.prototype.RegisterSensor = function (sensor) {

  // maintain a list of sensors registered to
  // this will automate things in case of reconnection
  const idx = this.sensors.indexOf(sensor);
  if (idx == -1) {
    this.sensors.push(sensor);
  }

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_RegisterSensor(sensor);
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 39
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(() => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
  
};

ComfoAirQ.prototype.SendCommand = function (node, message) {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_SendCommand(node, message);
      const rxkind = {
        'timestamp': new Date(),
        'kind' : 34
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
};

ComfoAirQ.prototype.VersionRequest = async function () {

  return new Promise((resolve, reject) => {
      
    try {
      const txData = before.cmd_VersionRequest();
      const rxkind = {
        'timestamp' : new Date(),
        'kind' : 68
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(() => {
          
          resolve({});
        },(reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });
      
    }
    catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);

    }
  });
  
};

ComfoAirQ.prototype.TimeRequest = function() {
  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_TimeRequest(this._settings);
      const rxkind = {
        'timestamp': new Date(),
        'kind': 31      // TimeConfirmType
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          resolve({});
        }, (reason) => {
          debugVerbose('comfo : TX reject -> ' + reason + ' -> ' + config.getTimestamp());
          reject(reason);
        });

    } catch (exc) {
      debugError('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + config.getTimestamp());
      reject(exc);
    }
  });
};

module.exports = ComfoAirQ; 

