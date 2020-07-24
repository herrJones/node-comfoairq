'use strict';

const Buffer = require('safe-buffer').Buffer;
const events = require('events');
//const emitter = new events.EventEmitter;

const comfoBridge = require('./bridge');
const before = require('./preparation');
const after = require('./analysis');

class ComfoAirQ extends events {

  constructor(options) {
    super();

    this._settings = {
      'pin':       options.pin,
      'uuid':      Buffer.from(options.uuid, 'hex'),
      'device':    options.device,
      'multicast': options.multicast,
      'port':      56747,
      'comfoAir':  options.comfoAir,
      'comfoUuid': Buffer.from(options.comfoUuid, 'hex'),
      'debug':     options.debug,
      'keepalive': 15000,
      'logger':    (options.logger && typeof options.logger === 'function') ? options.logger : console.log
    };

    this._status = {
      'connected': false,
      'reconnect': false,
      'resume': false //,
    };

    this._exec = {
      'keepalive': null,
      'reconnect': null
    };

    this.rxlist = []; // array of messages to receive

    this.nodes = [];
    this.sensors = [];

    this._bridge = new comfoBridge(this._settings);

    this._bridge.on('received', (data) => {
      data.msg = after.cmd_GatewayOperation(data.data);
      data.result = after.cmd_DecodeMessage(data.msg);
      data.error = data.msg.result;
      data.kind = data.msg.type;

      if (this.rxlist.length > 0) {
        const idx = this.rxlist.findIndex(({kind}) => kind === data.kind);
        if (idx >= 0) {
          this.rxlist.splice(idx);
        }
      }

      if (!this._settings.debug) {
        delete data.data;
        delete data.msg;
      }

      if (data.kind == 40) { // CnRpdoNotification
        data.result.data = after.analyze_CnRpdoNotification(data.result.data);

      } else if (data.kind == 53) { // StartSessionConfirm
        if (data.error == 'OK') {
          this._status.connected = true;

          if (data.result.data.resumed) {
            this._settings.logger('StartSessionConfirm --> OK - resuming session');
            this._status.resume = true;
          } else {
            this._status.resume = false;
          }
        } else {
          this._settings.logger('StartSessionConfirm --> ' + data.error);
          this._status.connected = false;
        }
        this._status.reconnect = true;
      } else if (data.kind == 31) { // CnTimeRequest
        this._settings.logger('CnTimeConfirm --> ' + data.error);
        // TODO
      } else if (data.kind == 32) { // CnNodeNotification
        // TODO
      
      } else if (data.kind == 4) { // CloseSessionRequest
        const reason = {
          state: 'OTHER_SESSION'
        };
        this.emit('disconnect', reason);
      } else if (data.kind == 52) {
        this._settings.logger('RegisterAppConfirm --> ' + data.error);
      }

      this.emit('receive', data);
    });
    this._bridge.on('error', (reason) => {
      try {
        this._settings.logger('comfo: ' + reason.error);
        this._status.connected = false;
      } catch (exc) {
        this._settings.logger('comfo: ' + JSON.stringify(reason) + exc);
      }
    });
    this._bridge.on('disconnect', () => {
      const reason = {
        state: 'DISC'
      };

      this._settings.logger('comfo: DISCONNECTED -> ' + (new Date(Date.now())).toLocaleString());
      this._status.connected = false;
      //if (this._exec.reconnect == null) {
      //  this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive)
      //}

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

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

ComfoAirQ.prototype._keepalive = async function() {

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
        this._settings.logger('timout receiving: ' + JSON.stringify(element) + ' -> ' + (new Date(Date.now())).toLocaleString());
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

      this._settings.logger('error sending KeepAlive: ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
    });
};

ComfoAirQ.prototype._reconnect = function() {

  if (this._status.connected) {
    return;
  }
  this._settings.logger('** starting reconnection -> ' + (new Date(Date.now())).toLocaleString());
  this.StartSession(false)
    .then(() => {
      //if (!this._status.resume) {
      // re-register to all previously registered sensors
      this.sensors.forEach(async sensor => {

        const result = await this.RegisterSensor(sensor);
        if (this._settings.debug) {
          this._settings.logger('SENSID: ' + sensor.toString() + ' - ' + JSON.stringify(result));
        }
        await sleep(100);
      });
      //}

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
      this._settings.logger('reconnect failure : ' + reason);

      this._exec.keepalive = null;
      this._exec.reconnect = setTimeout(this._reconnect.bind(this), this._settings.keepalive);
    });
};

// run a specific discovery of the comfoair device
ComfoAirQ.prototype.discover = function() {
  return new Promise((resolve, reject) => {
    try {
      this._bridge.discover().then((discovered) => {
        if (this._settings.debug) {
            this._settings.logger('comfoIP   : ' + discovered.comfoAir);
            this._settings.logger('comfoUUID : ' + discovered.comfoUuid);
        }

        resolve(discovered);
      });
    } catch (exc) {
      reject(exc);
    }
  });
};

ComfoAirQ.prototype.StartSession = function(force) {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_StartSession(force);
      const rxkind = {
        'timestamp': new Date(),
        'kind': 53
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          let cnt = 150;
          while (!this._bridge.isconnected) {
            await sleep(100);
          }

          while ((cnt-- > 0) && (!this._status.connected)) {
            await sleep(100);
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

        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      this.opensession = false;
      reject(exc);
    }
  });
};

ComfoAirQ.prototype.KeepAlive = function() {

  return new Promise((resolve, reject) => {
    try {
      const txData = before.cmd_KeepAlive();

      this._bridge.transmit(txData)
        .then(() => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }
  });

};

ComfoAirQ.prototype.CloseSession = function() {

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
          this._settings.logger('comfo : session closed -> ' + (new Date(Date.now())).toLocaleString());
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }
  });
};

ComfoAirQ.prototype.ListRegisteredApps = function() {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_ListRegisteredApps();
      const rxkind = {
        'timestamp': new Date(),
        'kind': 55
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }
  });

};

ComfoAirQ.prototype.RegisterApp = function() {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_RegisterApp(this._settings);
      const rxkind = {
        'timestamp': new Date(),
        'kind': 52
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }

  });

};

ComfoAirQ.prototype.DeRegisterApp = function(uuid) {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_DeRegisterApp(uuid);
      const rxkind = {
        'timestamp': new Date(),
        'kind': 56
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }

  });

};

ComfoAirQ.prototype.RegisterSensor = function(sensor) {

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
        'timestamp': new Date(),
        'kind': 39
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(() => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }

  });
};

ComfoAirQ.prototype.SendCommand = function(node, message) {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_SendCommand(node, message);
      const rxkind = {
        'timestamp': new Date(),
        'kind': 34
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(async () => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }

  });
};

ComfoAirQ.prototype.VersionRequest = async function() {

  return new Promise((resolve, reject) => {

    try {
      const txData = before.cmd_VersionRequest();
      const rxkind = {
        'timestamp': new Date(),
        'kind': 68
      };
      this.rxlist.push(rxkind);

      this._bridge.transmit(txData)
        .then(() => {
          resolve({});
        }, (reason) => {
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
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
          this._settings.logger('comfo : TX reject -> ' + reason + ' -> ' + (new Date(Date.now())).toLocaleString());
          reject(reason);
        });

    } catch (exc) {
      this._settings.logger('comfo : TX error -> ' + JSON.stringify(exc) + ' -> ' + (new Date(Date.now())).toLocaleString());
      reject(exc);
    }

  });
}
module.exports = ComfoAirQ;