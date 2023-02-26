# node-comfoairq

Library to control a Zehnder Comfoair Q series of ventilation devices

A Zehnder ComfoConnect LAN C interface is required to make this work

Development of this node.js plugin is heavily inspired on the work performed by:
* Michael Arnauts (https://github.com/michaelarnauts/comfoconnect)
* Marco Hoyer (https://github.com/marco-hoyer/zcan) and its forks on github (djwlindenaar, decontamin4t0R)

An API is provided to connect and read sensor data from the ComfoAirQ-unit

Revision history:

* 0.5.0 : first working version
* 0.5.1 : general bugfixes
* 0.5.2 : better handling of (forced) disconnects
* 0.5.3 : complete dependencies in package.json
* 0.5.4 : fix bug with registering devices
* 0.5.5 : extra commands to send to the comfoconnect device
          get time added
* 0.5.8 : ventilation mode commands fixed
* 0.5.9 : better use of debug messages
          update used packages

## Test Script

A test-application is provided to demonstrate the capabilities

1. Update the test/settings.json
2. Run the script

```
npm run test
```

## Range of functions

Not all functions are implemented as the plugin is designed for home automation

Only these are provided:

* start session
* keepalive
* send command
* close session
* register sensor
* get version
* get time
* list all registered apps
* register app
* deregister app

All functions return Promises

On 'received' and 'disconnect' events are provided

If a valid UUID is provided for the comfoconnect device, a discovery operation is no longer needed

## Quick-start


example settings.json
```

{
  "pin": 1234,
  "uuid" : "20200428000000000000000009080407",
  "device" : "node-comfoairq",
  "multicast": "192.168.1.255",
  "comfoair": "192.168.1.113",
  "comfoUuid": "00000000003410138001144fd71e24cc",
  "debug": false,
  "verbose": true
} 
```

example code
```javascript
const comfoconnect = require('node-comfoairq');
const settings = require(__dirname + '/settings.json');

const zehnder = new comfoconnect(settings);

zehnder.on('receive', (data) => {
  console.log(JSON.stringify(data));
});

zehnder.on('disconnect', (reason) => {
  if (reason.state == 'OTHER_SESSION') {
    console.log('other device became active');
    reconnect = true;
  }
  connected = false;
});

zehnder.discover();

await zehnder.StartSession(true);
// ..... do something ......
// -> find some inspiration in test\comfoTest.js
await zehnder.CloseSession();

```