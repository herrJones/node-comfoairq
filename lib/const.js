'use strict';

const msgCodes = [
  {code:   0, name: 'NoOperation'},
  {code:   4, name: 'CloseSessionRequest'},
  {code:  31, name: 'CnTimeConfirm'},
  {code:  32, name: 'CnNodeNotification'},
  {code:  34, name: 'CnRmiResponse'},
  {code:  36, name: 'CnRmiAsyncConfirm'},
  {code:  37, name: 'CnRmiAsyncResponse'},
  {code:  39, name: 'CnRpdoConfirm'},
  {code:  40, name: 'CnRpdoNotification'},
  {code:  41, name: 'CnAlarmNotification'},
  {code:  52, name: 'RegisterAppConfirm'},
  {code:  53, name: 'StartSessionConfirm'},
  {code:  54, name: 'CloseSessionConfirm'},
  {code:  55, name: 'ListRegisteredAppsConfirm'},
  {code:  56, name: 'DeregisterAppConfirm'},
  {code:  65, name: 'DebugConfirm'},
  {code:  68, name: 'VersionConfirm'},
  {code: 100, name: 'GatewayNotification'}
];

const comfoCommands = [
  {name: 'FAN_MODE_AWAY',    code: '84150101000000000100000000'},
  {name: 'FAN_MODE_LOW',     code: '84150101000000000100000001'},
  {name: 'FAN_MODE_MEDIUM',  code: '84150101000000000100000002'},
  {name: 'FAN_MODE_HIGH',    code: '84150101000000000100000003'},

  {name: 'FAN_BOOST_10M',    code: '84150106000000005802000003'},
  {name: 'FAN_BOOST_20M',    code: '8415010600000000B004000003'},
  {name: 'FAN_BOOST_30M',    code: '84150106000000000807000003'},
  {name: 'FAN_BOOST_END',    code: '85150106'},

  {name: 'MODE_AUTO',        code: '85150801'},
  {name: 'MODE_MANUAL',      code: '84150801000000000100000001'},

  {name: 'VENTMODE_SUPPLY',  code: '8415060100000000100e000001'},
  {name: 'VENTMODE_BALANCE', code: '85150601'},

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

const sensorCodes = [
  {code:  16, kind: 1, name: 'SENSOR_AWAY_INDICATOR'}, // (01 = low, medium, high fan speed, 07 = away)
  {code:  33, kind: 1, name: ''},
  {code:  37, kind: 1, name: ''},
  {code:  49, kind: 1, name: 'SENSOR_OPERATING_MODE_BIS'}, // (01 = limited manual, 05 = unlimited manual, ff = auto)
  {code:  53, kind: 1, name: ''},
  {code:  56, kind: 1, name: 'SENSOR_OPERATING_MODE'}, // (01 = unlimited manual, ff = auto)
  {code:  65, kind: 1, name: 'SENSOR_FAN_SPEED_MODE'}, // (00 (away), 01, 02 or 03)
  {code:  66, kind: 1, name: 'SENSOR_BYPASS_ACTIVATION_MODE'}, // (00 = auto, 01 = activated, 02 = deactivated)
  {code:  67, kind: 1, name: 'SENSOR_TEMPERATURE_PROFILE'}, // (00 = normal, 01 = cold, 02 = warm)
  {code:  70, kind: 1, name: ''},
  {code:  71, kind: 1, name: ''},
  {code:  81, kind: 3, name: 'SENSOR_FAN_NEXT_CHANGE'}, // (52020000 = 00000252 -> 594 seconds)
  {code:  82, kind: 3, name: ''},
  {code:  85, kind: 3, name: ''},
  {code:  86, kind: 3, name: ''},
  {code:  87, kind: 3, name: ''},
  {code: 117, kind: 1, name: 'SENSOR_FAN_EXHAUST_DUTY'}, // (1c = 28%)
  {code: 118, kind: 1, name: 'SENSOR_FAN_SUPPLY_DUTY'}, // (1d = 29%)
  {code: 119, kind: 2, name: 'SENSOR_FAN_EXHAUST_FLOW'}, // (6e00 = 110 m³/h)
  {code: 120, kind: 2, name: 'SENSOR_FAN_SUPPLY_FLOW'}, // (6900 = 105 m³/h)
  {code: 121, kind: 2, name: 'SENSOR_FAN_EXHAUST_SPEED'}, // (2d04 = 1069 rpm)
  {code: 122, kind: 2, name: 'SENSOR_FAN_SUPPLY_SPEED'}, // (5904 = 1113 rpm)
  {code: 128, kind: 2, name: 'SENSOR_POWER_CURRENT'}, // (0f00 = 15 W)
  {code: 129, kind: 2, name: 'SENSOR_POWER_TOTAL_YEAR'}, // (1700 = 23 kWh)
  {code: 130, kind: 2, name: 'SENSOR_POWER_TOTAL'}, // (1700 = 23 kWh)
  {code: 144, kind: 2, name: 'SENSOR_PREHEATER_POWER_TOTAL_YEAR'}, // (1700 = 23 kWh)
  {code: 145, kind: 2, name: 'SENSOR_PREHEATER_POWER_TOTAL'}, // (1700 = 23 kWh)
  {code: 146, kind: 2, name: 'SENSOR_PREHEATER_POWER_CURRENT'}, // (0f00 = 15 W)
  {code: 176, kind: 1, name: ''},
  {code: 192, kind: 2, name: 'SENSOR_DAYS_TO_REPLACE_FILTER'}, // (8200 = 130 days)
  {code: 208, kind: 1, name: ''},
  {code: 209, kind: 6, name: 'SENSOR_CURRENT_RMOT'}, // (7500 = 117 -> 11.7 °C)
  {code: 210, kind: 0, name: ''},
  {code: 211, kind: 0, name: ''},
  {code: 212, kind: 6, name: ''},
  {code: 213, kind: 2, name: 'SENSOR_AVOIDED_HEATING_CURRENT'}, // (b901 = 441 -> 4.41 W)
  {code: 214, kind: 2, name: 'SENSOR_AVOIDED_HEATING_TOTAL_YEAR'}, // (dd01 = 477 kWh)
  {code: 215, kind: 2, name: 'SENSOR_AVOIDED_HEATING_TOTAL'}, // (dd01 = 477 kWh)
  {code: 216, kind: 2, name: 'SENSOR_AVOIDED_COOLING_CURRENT'}, // (b901 = 441 -> 4.41 W)
  {code: 217, kind: 2, name: 'SENSOR_AVOIDED_COOLING_TOTAL_YEAR'}, // (dd01 = 477 kWh)
  {code: 218, kind: 2, name: 'SENSOR_AVOIDED_COOLING_TOTAL'}, //  (dd01 = 477 kWh)
  {code: 219, kind: 2, name: ''},
  {code: 221, kind: 6, name: 'SENSOR_TEMPERATURE_SUPPLY'},
  {code: 224, kind: 1, name: ''},
  {code: 225, kind: 1, name: ''},
  {code: 226, kind: 2, name: ''},
  {code: 227, kind: 1, name: 'SENSOR_BYPASS_STATE'}, // (64 = 100%)
  {code: 228, kind: 1, name: ''},
  {code: 274, kind: 6, name: 'SENSOR_TEMPERATURE_EXTRACT'}, // (ab00 = 171 -> 17.1 °C)
  {code: 275, kind: 6, name: 'SENSOR_TEMPERATURE_EXHAUST'}, // (5600 = 86 -> 8.6 °C)
  {code: 276, kind: 6, name: 'SENSOR_TEMPERATURE_OUTDOOR'}, // (3c00 = 60 -> 6.0 °C)
  {code: 290, kind: 1, name: 'SENSOR_HUMIDITY_EXTRACT'}, // (31 = 49%)
  {code: 291, kind: 1, name: 'SENSOR_HUMIDITY_EXHAUST'}, // (57 = 87%)
  {code: 292, kind: 1, name: 'SENSOR_HUMIDITY_OUTDOOR'}, // (43 = 67%)
  {code: 294, kind: 1, name: 'SENSOR_HUMIDITY_SUPPLY'}, // (23 = 35%)
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

module.exports = {
  msgCodes,
  sensorCodes,
  comfoCommands
};