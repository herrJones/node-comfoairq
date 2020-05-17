'use strict'

const comfo = require('../lib/comfoconnect');
const zehnder = new comfo()
const settings = require(__dirname + "/settings.json");

zehnder.settings = settings;
zehnder.discover();


const readline = require("readline");
const trmnl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

//var initialized = false;
//var connected = false;
//var reconnect = false;

zehnder.on('receive', (data) => {
  console.log(JSON.stringify(data));
});
zehnder.on('disconnect', (reason) => {
  if (reason.state == 'OTHER_SESSION') {
    console.log('other device became active');
    // = true;
  }
  //connected = false;
})
/*
function keepAlive() {
  if (!connected) {
    if (reconnect) {
      setTimeout(restartSession, 15000);
    }
    return  
  }

  zehnder.KeepAlive();

  setTimeout(keepAlive, 30000);
}
*/
/*
async function restartSession() {
  console.log('** attempting reconnect **')

  try {
    let result = await zehnder.StartSession(false);
    console.log(JSON.stringify(result));
    connected = true;

    result = await zehnder.RegisterSensor(227);
    console.log(JSON.stringify(result));

    setTimeout(keepAlive, 5000);
  }
  catch (exc) {
    console.log(exc);
    setTimeout(restartSession, 15000);
  }
}
*/

var waitForCommand = function () {
  trmnl.question("zehnder command to test (? for help)  ",async function(answer) {
    if (answer == "?") {
        console.log("?    -- this help function\n" +
                    "srch -- (re)run discovery\n" +
                    "lapp -- List Registered Apps\n" +
                    "rapp -- Register App\n" +
                    "uapp -- UnRegister App\n" +
                    "info -- fetch ComfoAir version\n" +
                    "conn -- connect to ComfoAir unit\n" +
                    "sens -- register to updates on sensors\n" +
                    "cmnd -- send a command to the unit (nodeid command - 10 FAN_MODE_HIGH)\n" +
                    "disc -- disconnect from ComfoAir unit\n" +
                    "quit -- close this application\n\n" );

    } else if (answer == "srch") {
      console.log('(re)running discovery\n');

      let result = await zehnder.discover();
      console.log(JSON.stringify(result));
    } else if (answer == "lapp") {
      console.log('list registered apps\n');
      
      let result = await zehnder.ListRegisteredApps();
      console.log(JSON.stringify(result));

    } else if (answer == "rapp") {
      console.log('register this app\n');
      
      let result = await zehnder.RegisterApp();
      console.log(JSON.stringify(result));

    } else if (answer.startsWith("uapp")) {
      console.log('unregister this app\n');
     
      let uuid = answer.slice(5);
      let result = await zehnder.DeRegisterApp(uuid);
      console.log(JSON.stringify(result));
      

    } else if (answer == "info") {
      console.log('fetch ComfoAir info\n');

      let result = await zehnder.VersionRequest();
      console.log(JSON.stringify(result));

    } else if (answer == "conn") {
      console.log('connect to ComfoAir unit\n');

      try {
        let result = await zehnder.StartSession(true);
        console.log(JSON.stringify(result));
        //connected = true;
        //reconnect = true;

        result = await zehnder.RegisterSensor(227);
        console.log(JSON.stringify(result));

        //setTimeout(keepAlive, 30000);
      }
      catch (exc) {
        console.log(exc);
      }

    } else if (answer.startsWith("sens")) {
      console.log('register to updates on sensors\n');

      let sensID = answer.slice(5)
      let result = await zehnder.RegisterSensor(Number(sensID));
      console.log(JSON.stringify(result));

    } else if (answer.startsWith("cmnd")) {

      let cmnd = answer.slice(5).split(' ');
      
      console.log('sending command to unit: ' + cmnd[1].toUpperCase());

      try {
      let result = await zehnder.SendCommand(Number(cmnd[0]), cmnd[1].toUpperCase());
      console.log(JSON.stringify(result));
      }
      catch (exc) {
        console.log('cmnd error: ' + exc)
      }
    } else if (answer == "disc") {
      console.log('disconnect from ComfoAir unit\n'); 
      await zehnder.CloseSession();
      //connected = false;
      //reconnect = false;
    } else if (answer == "quit") {
      console.log('closing down');
      await zehnder.CloseSession();
      //connected = false;
      //reconnect = false
      trmnl.close();
    } 
        
    waitForCommand();
    
  });

}
/*
zehnder.bridge.on('receive', () => {
  console.log('test')
})*/

waitForCommand();

//setTimeout(getResponse, 1000);

trmnl.on("close", function() {
    console.log("\nBYE BYE !!!");
    process.exit(0);
});
