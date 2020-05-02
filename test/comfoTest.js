'use strict'

const zehnder = require('../lib/comfoconnect');

const readline = require("readline");
const trmnl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var connected = false;

async function getResponse() {

  zehnder.receive()
    .catch((exc) => {
      console.error(exc);

      if (exc.message == 'NOT_ALLOWED') {
        //
      }
    })
    .then((data) => {
      let rxdata = JSON.stringify(data);
      if (rxdata != '{}') {
        console.log(rxdata);
      }
    });
    
  setTimeout(getResponse, 500);
  zehnder.keepalive();
}

var waitForCommand = function () {
  trmnl.question("zehnder command to test (? for help)  ", function(answer) {
    if (answer == "?") {
        console.log("?    -- this help function\n" +
                    "srch -- (re)run discovery\n" +
                    "lapp -- List Registered Apps\n" +
                    "rapp -- Register App\n" +
                    "uapp -- UnRegister App\n" +
                    "info -- fetch ComfoAir version\n" +
                    "conn -- connect to ComfoAir unit\n" +
                    "sens -- register to updates on sensors\n" +
                    "disc -- disconnect from ComfoAir unit\n" +
                    "quit -- close this application\n\n" );

    } else if (answer == "srch") {
      console.log('(re)running discovery\n');

      zehnder.discover();
    } else if (answer == "lapp") {
      console.log('list registered apps\n');
      
      zehnder.listapps();
      
    } else if (answer == "rapp") {
      console.log('register this app\n');
      
      zehnder.register();


    } else if (answer.startsWith("uapp")) {
      console.log('unregister this app\n');
     
      let uuid = answer.slice(5);
      zehnder.unregister(uuid);

    } else if (answer == "info") {
      console.log('fetch ComfoAir info\n');

      zehnder.version();
      
    } else if (answer == "conn") {
      console.log('connect to ComfoAir unit\n');
      
      zehnder.connect(true);
      connected = true;
    } else if (answer.startsWith("sens")) {
      console.log('register to updates on sensors\n');

      let sensID = answer.slice(5)
      zehnder.sensors(Number(sensID));

      //checkSensors = true;
    } else if (answer == "disc") {
      console.log('disconnect from ComfoAir unit\n'); 
      zehnder.disconnect();
      connected = false;
    } else if (answer == "quit") {
      console.log('closing down');
      zehnder.disconnect();
      connected = false;
      trmnl.close();
    } 
        
    waitForCommand();
    
  });

  
}

waitForCommand();

getResponse();

trmnl.on("close", function() {
    console.log("\nBYE BYE !!!");
    process.exit(0);
});
