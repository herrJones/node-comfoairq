'use strict'

const zehnder = require('../lib/comfoconnect');

const readline = require("readline");
const trmnl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var checkFeedback = false;

function getFeedback() {
  if (!checkFeedback) {
    setTimeout(getFeedback, 500);
    return;
  }

  zehnder.notifies((data) => {
    let rxdata = JSON.stringify(data);
    if (rxdata != '{}') {
      console.log(rxdata);
    }
    
    setTimeout(getFeedback, 500);
    zehnder.keepalive((data) => {});
  })
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
      
      zehnder.listapps((data) => {
        console.log(JSON.stringify(data))
      });
      
    } else if (answer == "rapp") {
      console.log('register this app\n');
   
      zehnder.register((data) => {
        console.log(JSON.stringify(data))
      })


    } else if (answer.startsWith("uapp")) {
      console.log('unregister this app\n');
   
      let uuid = answer.slice(5);
      zehnder.unregister(uuid, (data) => {
        console.log(JSON.stringify(data))
      })

    } else if (answer == "info") {
      console.log('fetch ComfoAir info\n');

      zehnder.version((data) => {
        console.log(JSON.stringify(data))
      });
      
    } else if (answer == "conn") {
      console.log('connect to ComfoAir unit\n');
      
      zehnder.connect(true, (data) => {
        //if (data.error == 'NOT_ALLOWED') {
        //  zehnder.register((data) => {
            
        console.log(JSON.stringify(data));
        checkFeedback = true
        //    console.log('please connect again');
        //  })
        //}
      });
    } else if (answer.startsWith("sens")) {
      console.log('register to updates on sensors\n');

      let sensID = answer.slice(5)
      zehnder.sensors(Number(sensID), (data) => {
        console.log(JSON.stringify(data));

        //checkSensors = true;
      }).catch((err) => {
        console.warn('rejected : ' + err)
      })

      //checkSensors = true;
    } else if (answer == "disc") {
      console.log('disconnect from ComfoAir unit\n'); 
      zehnder.disconnect((data) => {
        console.log(JSON.stringify(data));
        checkFeedback = false;
      });
    } else if (answer == "quit") {
      console.log('closing down');
      zehnder.disconnect();
      trmnl.close();
    } 
        
    waitForCommand();
    
  });

  
}

waitForCommand();

getFeedback();

trmnl.on("close", function() {
    console.log("\nBYE BYE !!!");
    process.exit(0);
});
