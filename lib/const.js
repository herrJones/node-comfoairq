'use strict';

const msgCodes = [
  {code:   0, name: 'NoOperation'},
  {code:   4, name: 'CloseSessionRequest'},
  {code:   5, name: 'ListRegisteredAppsRequest'},
  {code:   6, name: 'DeRegisterAppRequest'},
  {code:   7, name: 'ChangePinRequest'},
  {code:  15, name: 'DebugRequest'},
  {code:  16, name: 'UpgradeRequest'},
  {code:  18, name: 'VersionRequest'},
  {code:  31, name: 'CnTimeConfirm'},
  {code:  32, name: 'CnNodeNotification'},
  {code:  34, name: 'CnRmiResponse'},
  {code:  35, name: 'CnRmiAsyncRequest'},
  {code:  36, name: 'CnRmiAsyncConfirm'},
  {code:  37, name: 'CnRmiAsyncResponse'},
  {code:  38, name: 'CnRpdoRequest'},
  {code:  39, name: 'CnRpdoConfirm'},
  {code:  40, name: 'CnRpdoNotification'},
  {code:  41, name: 'CnAlarmNotification'},
  {code:  42, name: 'CnNodeRequest'},
  {code:  52, name: 'RegisterAppConfirm'},
  {code:  53, name: 'StartSessionConfirm'},
  {code:  54, name: 'CloseSessionConfirm'},
  {code:  55, name: 'ListRegisteredAppsConfirm'},
  {code:  56, name: 'DeregisterAppConfirm'},
  {code:  57, name: 'ChangePinConfirm'},
  {code:  65, name: 'DebugConfirm'},
  {code:  66, name: 'UpgradeConfirm'},
  {code:  68, name: 'VersionConfirm'},
  {code: 100, name: 'GatewayNotification'},
  {code: 101, name: 'KeepAlive'}
];

const comfoCommands = [
  {name: 'FAN_MODE_AWAY',    code: '84150101000000000100000000'},
  {name: 'FAN_MODE_LOW',     code: '84150101000000000100000001'},
  {name: 'FAN_MODE_MEDIUM',  code: '84150101000000000100000002'},
  {name: 'FAN_MODE_HIGH',    code: '84150101000000000100000003'},

  {name: 'FAN_BOOST_10M',    code: '84150106000000005802000003'},
  {name: 'FAN_BOOST_20M',    code: '8415010600000000B004000003'},
  {name: 'FAN_BOOST_30M',    code: '84150106000000000807000003'},
  {name: 'FAN_BOOST_60M',    code: '8415010600000000100e000003'},
  {name: 'FAN_BOOST_90M',    code: '84150106000000001815000003'},
  {name: 'FAN_BOOST',        code: '8415010600000000FFFFFFFF03'},
  {name: 'FAN_BOOST_END',    code: '85150106'},

  {name: 'MODE_AUTO',        code: '85150801'},
  {name: 'MODE_MANUAL',      code: '84150801000000000100000001'},

  {name: 'VENTMODE_SUPPLY',      code: '8415060100000000100e000001'},
  {name: 'VENTMODE_BALANCE',     code: '85150601'},
  {name: 'VENTMODE_SUPPLY_OFF',  code: '85150601'},

  {name: 'VENTMODE_EXTRACT',     code: '8415070100000000100e000001'},
  {name: 'VENTMODE_EXTRACT_OFF', code: '85150701'},

  {name: 'TEMPPROF_NORMAL',  code: '8415030100000000ffffffff00'},
  {name: 'TEMPPROF_COOL',    code: '8415030100000000ffffffff01'},
  {name: 'TEMPPROF_WARM',    code: '8415030100000000ffffffff02'},

  {name: 'BYPASS_ON',        code: '8415020100000000100e000001'},
  {name: 'BYPASS_OFF',       code: '8415020100000000100e000002'},
  {name: 'BYPASS_AUTO',      code: '85150201'},

  {name: 'SENSOR_TEMP_OFF',  code: '031d010400'},
  {name: 'SENSOR_TEMP_AUTO', code: '031d010401'},
  {name: 'SENSOR_TEMP_ON',   code: '031d010402'},
  {name: 'SENSOR_HUMC_OFF',  code: '031d010600'},
  {name: 'SENSOR_HUMC_AUTO', code: '031d010601'},
  {name: 'SENSOR_HUMC_ON',   code: '031d010602'},
  {name: 'SENSOR_HUMP_OFF',  code: '031d010700'},
  {name: 'SENSOR_HUMP_AUTO', code: '031d010701'},
  {name: 'SENSOR_HUMP_ON',   code: '031d010702'}
];


// sensorcode.kind:
// * 0 : unknown
// * 1 :  8-bit integer value
// * 2 : 16-bit integer value
// * 3 : 32-bit integer value
// * 6 : 16-bit decimal value
const sensorCodes = [
  {code:  16, kind: 1, name: 'SENSOR_AWAY_INDICATOR'},          // (0x01 = low, medium, high fan speed, 07 = away)
  {code:  33, kind: 1, name: ''},
  {code:  37, kind: 1, name: ''},
  {code:  49, kind: 1, name: 'SENSOR_OPERATING_MODE_BIS'},      // (0x01 = limited manual, 0x05 = unlimited manual, 0xff = auto)
  {code:  53, kind: 1, name: ''},
  {code:  56, kind: 1, name: 'SENSOR_OPERATING_MODE'},          // (0x01 = unlimited manual, 0xff = auto)
  {code:  65, kind: 1, name: 'SENSOR_FAN_SPEED_MODE'},          // (0x00 (away), 0x01 (low), 0x02 (medium) or 0x03 (high))
  {code:  66, kind: 1, name: 'SENSOR_BYPASS_ACTIVATION_MODE'},  // (0x00 = auto, 0x01 = activated, 0x02 = deactivated)
  {code:  67, kind: 1, name: 'SENSOR_TEMPERATURE_PROFILE'},     // (0x00 = normal, 0x01 = cold, 0x02 = warm)
  {code:  70, kind: 1, name: 'SENSOR_FAN_MODE_SUPPLY'},
  {code:  71, kind: 1, name: 'SENSOR_FAN_MODE_EXHAUST'},
  {code:  81, kind: 3, name: 'SENSOR_FAN_NEXT_CHANGE'},         // (0x52020000 = 0x00000252 -> 594 seconds)
  {code:  82, kind: 3, name: 'SENSOR_BYPASS_NEXT_CHANGE'},
  {code:  85, kind: 3, name: ''},
  {code:  86, kind: 3, name: 'SENSOR_SUPPLY_NEXT_CHANGE'},
  {code:  87, kind: 3, name: 'SENSOR_EXHAUST_NEXT_CHANGE'},
  {code: 117, kind: 1, name: 'SENSOR_FAN_EXHAUST_DUTY'},        // (0x1c = 28%)
  {code: 118, kind: 1, name: 'SENSOR_FAN_SUPPLY_DUTY'},         // (0x1d = 29%)
  {code: 119, kind: 2, name: 'SENSOR_FAN_EXHAUST_FLOW'},        // (0x6e00 = 110 m³/h)
  {code: 120, kind: 2, name: 'SENSOR_FAN_SUPPLY_FLOW'},         // (0x6900 = 105 m³/h)
  {code: 121, kind: 2, name: 'SENSOR_FAN_EXHAUST_SPEED'},       // (0x2d04 = 1069 rpm)
  {code: 122, kind: 2, name: 'SENSOR_FAN_SUPPLY_SPEED'},        // (0x5904 = 1113 rpm)
  {code: 128, kind: 2, name: 'SENSOR_POWER_CURRENT'},           // (0x0f00 = 15 W)
  {code: 129, kind: 2, name: 'SENSOR_POWER_TOTAL_YEAR'},        // (0x1700 = 23 kWh)
  {code: 130, kind: 2, name: 'SENSOR_POWER_TOTAL'},             // (0x1700 = 23 kWh)
  {code: 144, kind: 2, name: 'SENSOR_PREHEATER_POWER_TOTAL_YEAR'}, // (0x1700 = 23 kWh)
  {code: 145, kind: 2, name: 'SENSOR_PREHEATER_POWER_TOTAL'},   // (0x1700 = 23 kWh)
  {code: 146, kind: 2, name: 'SENSOR_PREHEATER_POWER_CURRENT'}, // (0x0f00 = 15 W)
  {code: 176, kind: 1, name: 'SENSOR_SETTING_RF_PAIRING'},
  {code: 192, kind: 2, name: 'SENSOR_DAYS_TO_REPLACE_FILTER'},  // (0x8200 = 130 days)
  {code: 208, kind: 1, name: ''},
  {code: 209, kind: 6, name: 'SENSOR_CURRENT_RMOT'},            // (0x7500 = 117 -> 11.7 °C)
  {code: 210, kind: 0, name: 'SENSOR_HEATING_SEASON'},
  {code: 211, kind: 0, name: 'SENSOR_COOLING_SEASON'},
  {code: 212, kind: 6, name: 'SENSOR_TARGET_TEMPERATURE'},
  {code: 213, kind: 2, name: 'SENSOR_AVOIDED_HEATING_CURRENT'},    // (0xb901 = 441 -> 4.41 W)
  {code: 214, kind: 2, name: 'SENSOR_AVOIDED_HEATING_TOTAL_YEAR'}, // (0xdd01 = 477 kWh)
  {code: 215, kind: 2, name: 'SENSOR_AVOIDED_HEATING_TOTAL'},      // (0xdd01 = 477 kWh)
  {code: 216, kind: 2, name: 'SENSOR_AVOIDED_COOLING_CURRENT'},    // (0xb901 = 441 -> 4.41 W)
  {code: 217, kind: 2, name: 'SENSOR_AVOIDED_COOLING_TOTAL_YEAR'}, // (0xdd01 = 477 kWh)
  {code: 218, kind: 2, name: 'SENSOR_AVOIDED_COOLING_TOTAL'},      //  (0xdd01 = 477 kWh)
  {code: 219, kind: 2, name: 'SENSOR_AVOIDED_COOLING_CURRENT_TARGET'},
  {code: 221, kind: 6, name: 'SENSOR_TEMPERATURE_SUPPLY'},
  {code: 224, kind: 1, name: ''},
  {code: 225, kind: 1, name: 'SENSOR_COMFORTCONTROL_MODE'},
  {code: 226, kind: 2, name: 'SENSOR_FAN_SPEED_MODE_MODULATED'},
  {code: 227, kind: 1, name: 'SENSOR_BYPASS_STATE'},               // (0x64 = 100%)
  {code: 228, kind: 1, name: 'SENSOR_FROSTPROTECTION_UNBALANCE'},
  {code: 274, kind: 6, name: 'SENSOR_TEMPERATURE_EXTRACT'},        // (0xab00 = 171 -> 17.1 °C)
  {code: 275, kind: 6, name: 'SENSOR_TEMPERATURE_EXHAUST'},        // (0x5600 = 86 -> 8.6 °C)
  {code: 276, kind: 6, name: 'SENSOR_TEMPERATURE_OUTDOOR'},        // (0x3c00 = 60 -> 6.0 °C)
  {code: 277, kind: 6, name: 'SENSOR_TEMPERATURE_AFTER_PREHEATER'},
  {code: 290, kind: 1, name: 'SENSOR_HUMIDITY_EXTRACT'},           // (0x31 = 49%)
  {code: 291, kind: 1, name: 'SENSOR_HUMIDITY_EXHAUST'},           // (0x57 = 87%)
  {code: 292, kind: 1, name: 'SENSOR_HUMIDITY_OUTDOOR'},           // (0x43 = 67%)
  {code: 293, kind: 1, name: 'SENSOR_HUMIDITY_AFTER_PREHEATER '},          
  {code: 294, kind: 1, name: 'SENSOR_HUMIDITY_SUPPLY'},            // (0x23 = 35%)
  {code: 321, kind: 2, name: ''},
  {code: 325, kind: 2, name: ''},
  {code: 337, kind: 3, name: ''},
  {code: 338, kind: 3, name: ''},
  {code: 341, kind: 3, name: ''},
  {code: 369, kind: 1, name: ''},
  {code: 370, kind: 1, name: ''},
  {code: 371, kind: 1, name: ''},
  {code: 372, kind: 1, name: ''},
  {code: 384, kind: 6, name: ''},
  {code: 386, kind: 0, name: ''},
  {code: 400, kind: 6, name: ''},
  {code: 401, kind: 1, name: ''},
  {code: 402, kind: 0, name: ''},
  {code: 416, kind: 6, name: ''},
  {code: 417, kind: 6, name: ''},
  {code: 418, kind: 1, name: ''},
  {code: 419, kind: 0, name: ''},
];

const productCodes = [
  {code: 1,  name: 'ComfoAirQ'},
  {code: 2,  name: 'ComfoSense'},
  {code: 3,  name: 'ComfoSwitch'},
  {code: 4,  name: 'OptionBox'},
  {code: 5,  name: 'ZehnderGateway'},
  {code: 6,  name: 'ComfoCool'},
  {code: 7,  name: 'KNXGateway'},
  {code: 8,  name: 'Service Tool'},
  {code: 9,  name: 'Production test tool'},
  {code: 10, name: 'Design verification test tool'}
];

/*
 * create timestamp for logging on screen
 */
const getTimestamp = () => {
  const current_datetime = new Date();
              
  return current_datetime.getFullYear() + '-' 
      + (current_datetime.getMonth() + 1).toString().padStart(2, '0') + '-' 
      + current_datetime.getDate().toString().padStart(2, '0') + ' ' 
      + current_datetime.getHours().toString().padStart(2, '0') + ':' 
      + current_datetime.getMinutes().toString().padStart(2, '0') + ':' 
      + current_datetime.getSeconds().toString().padStart(2, '0');
};

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

module.exports = {
  msgCodes,
  sensorCodes,
  comfoCommands,
  productCodes,

  getTimestamp,
  sleep
};

