var async               = require("async"),
    wifi_manager        = require("./app/wifi_manager")(),
    dependency_manager  = require("./app/dependency_manager")(),
    exec                = require("child_process").exec,
    config              = require("./config.json"),
    GPIO                = require('onoff').Gpio,
    button              = new GPIO(18, 'in', 'both');

/*****************************************************************************\
    1. Check for dependencies
    2. Check to see if we are connected to a wifi AP
    3. If connected to a wifi, do nothing -> exit
    4. Convert RPI to act as a AP (with a configurable SSID)
    5. Host a lightweight HTTP server which allows for the user to connect and
       configure the RPIs wifi connection. The interfaces exposed are RESTy so
       other applications can similarly implement their own UIs around the
       data returned.
    6. Once the RPI is successfully configured, reset it to act as a wifi
       device (not AP anymore), and setup its wifi network based on what the
       user picked.
    7. At this stage, the RPI is named, and has a valid wifi connection which
       its bound to, reboot the pi and re-run this script on startup.
\*****************************************************************************/

var configuring = 0;

function buttonCallback(err, state) {
  // check the state of the button
  // 1 == pressed, 0 == not pressed
  // console.log('conf:'+configuring);
  if( (state == 1) && (configuring == 0) ) {
     console.log('pressed');
     configuring = 1;
     wifi_manager.enable_ap_mode(config.access_point.ssid, function(error) {
       if(error) {
         console.log("BUTTON... AP Enable ERROR: " + error);
       }else{
         console.log("BUTTON... AP Enable Success!");
	  configuring = 0;
          exec("systemctl enable hostapd.service", function(error, stdout, stderr) { });
          exec("systemctl enable isc-dhcp-server.service", function(error, stdout, stderr) { });
          exec("systemctl disable wpa_supplicant.service", function(error, stdout, stderr) { });
	  exec("reboot", function(error, stdout, stderr) { });
       }
     });

  } /* else {
    console.log('unpressed');
  }*/
}

async.series([

    // 1. Check if we have the required dependencies installed
    function test_deps(next_step) {
        dependency_manager.check_deps({
            "binaries": ["dhcpd", "hostapd", "iw"],
            "files":    ["/etc/init.d/isc-dhcp-server"]
        }, function(error) {
            if (error) console.log(" * Dependency error, did you run `sudo npm run-script provision`?");
            next_step(error);
        });
    },

    // 2. Check if wifi is enabled / connected
    function test_is_wifi_enabled(next_step) {
        wifi_manager.is_wifi_enabled(function(error, result_ip) {
            if (result_ip) {
                console.log("\nWifi is enabled, and IP " + result_ip + " assigned");
                if(config.button != 'on') {
                    process.exit(0);
                }
            } else {
                console.log("\nWifi is not enabled, Enabling AP for self-configure");
            }
            next_step(error);
        });
    },

    // 3. Turn RPI into an access point
    function enable_rpi_ap(next_step) {
        if(true) { //config.button != 'on') { // button is not interesting
            wifi_manager.enable_ap_mode(config.access_point.ssid, function(error) {
                if(error) {
                    console.log("... AP Enable ERROR: " + error);
                } else {
                    console.log("... AP Enable Success!");
                }
            });
        }
        next_step('');
    },


    // 4. attach a callback that check if the button is pressed
    function button_check(next_step) {
	if(config.button == 'on') {
            button.watch(buttonCallback);        
        }
        next_step('');
    },

    // 5. Host HTTP server while functioning as AP, the "api.js"
    //    file contains all the needed logic to get a basic express
    //    server up. It uses a small angular application which allows
    //    us to choose the wifi of our choosing.
    function start_http_server(next_step) {
        require("./app/api.js")(wifi_manager, next_step);
    },

], function(error) {
    if (error) {
        console.log("ERROR: " + error);
    }
});
