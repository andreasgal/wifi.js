/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Telephony.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andreas Gal <gal@mozilla.com>
 *   Blake Kaplan <mrbkap@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const DEBUG = true; // set to false to suppress debug messages

const WIFIWORKER_CONTRACTID = "@mozilla.org/wifi/worker;1";
const WIFIWORKER_CID        = Components.ID("{a14e8977-d259-433a-a88d-58dd44657e5b}");

const WIFIWORKER_WORKER     = "resource://gre/modules/network_worker.js";

var WifiManager = (function() {
  var controlWorker = new ChromeWorker(WIFIWORKER_WORKER);
  var eventWorker = new ChromeWorker(WIFIWORKER_WORKER);

  // Callbacks to invoke when a reply arrives from the controlWorker.
  var controlCallbacks = Object.create(null);
  var idgen = 0;

  function controlMessage(obj, callback) {
    var id = idgen++;
    obj.id = id;
    if (callback)
      controlCallbacks[id] = callback;
    controlWorker.postMessage(obj);
  }

  function onerror(e) {
    // It is very important to call preventDefault on the event here.
    // If an exception is thrown on the worker, it bubbles out to the
    // component that created it. If that component doesn't have an
    // onerror handler, the worker will try to call the error reporter
    // on the context it was created on. However, That doesn't work
    // for component contexts and can result in crashes. This onerror
    // handler has to make sure that it calls preventDefault on the
    // incoming event.
    e.preventDefault();

    var worker = (this === controlWorker) ? "control" : "event";

    debug("Got an error from the " + worker + " worker: " + e.filename +
          ":" + e.lineno + ": " + e.message + "\n");
  }

  controlWorker.onerror = onerror;
  eventWorker.onerror = onerror;

  controlWorker.onmessage = function(e) {
    var data = e.data;
    var id = data.id;
    var callback = controlCallbacks[id];
    if (callback) {
      callback(data);
      delete controlCallbacks[id];
    }
  };

  // Polling the status worker
  var recvErrors = 0;
  eventWorker.onmessage = function(e) {
    // process the event and tell the event worker to listen for more events
    if (handleEvent(e.data.event))
      waitForEvent();
  };

  function waitForEvent() {
    eventWorker.postMessage({ cmd: "wait_for_event" });
  }

  // Commands to the control worker

  function voidControlMessage(cmd, callback) {
    controlMessage({ cmd: cmd }, function (data) {
      callback(data.status);
    });
  }

  function loadDriver(callback) {
    voidControlMessage("load_driver", callback);
  }

  function unloadDriver(callback) {
    voidControlMessage("unload_driver", callback);
  }

  function startSupplicant(callback) {
    voidControlMessage("start_supplicant", callback);
  }

  function stopSupplicant(callback) {
    voidControlMessage("stop_supplicant", callback);
  }

  function connectToSupplicant(callback) {
    voidControlMessage("connect_to_supplicant", callback);
  }

  function closeSupplicantConnection(callback) {
    voidControlMessage("close_supplicant_connection", callback);
  }

  function doCommand(request, callback) {
    controlMessage({ cmd: "command", request: request }, callback);
  }

  function doIntCommand(request, callback) {
    doCommand(request, function(data) {
      callback(data.status ? -1 : (data.reply|0));
    });
  }

  function doBooleanCommand(request, expected, callback) {
    doCommand(request, function(data) {
      callback(data.status ? false : (data.reply == expected));
    });
  }

  function doStringCommand(request, callback) {
    doCommand(request, function(data) {
      callback(data.status ? null : data.reply);
    });
  }

  function listNetworksCommand(callback) {
    doStringCommand("LIST_NETWORKS", callback);
  }

  function addNetworkCommand(callback) {
    doIntCommand("ADD_NETWORK", callback);
  }

  function setNetworkVariableCommand(netId, name, value, callback) {
    doBooleanCommand("SET_NETWORK " + netId + " " + name + " " + value, "OK", callback);
  }

  function getNetworkVariableCommand(netId, name, callback) {
    doStringCommand("GET_NETWORK " + netId + " " + name, callback);
  }

  function removeNetworkCommand(netId, callback) {
    doBooleanCommand("REMOVE_NETWORK " + netId, callback);
  }

  function enableNetworkCommand(netId, disableOthers, callback) {
    doBooleanCommand((disableOthers ? "SELECT_NETWORK " : "ENABLE_NETWORK ") + netId, "OK", callback);
  }

  function disableNetworkCommand(netId, callback) {
    doBooleanCommand("DISABLE_NETWORK " + netId, "OK", callback);
  }

  function statusCommand(callback) {
    doStringCommand("STATUS", callback);
  }

  function pingCommand(callback) {
    doBooleanCommand("PING", "PONG", callback);
  }

  function scanResultsCommand(callback) {
    doStringCommand("SCAN_RESULTS", callback);
  }

  function disconnectCommand(callback) {
    doBooleanCommand("DISCONNECT", "OK", callback);
  }

  function reconnectCommand(callback) {
    doBooleanCommand("RECONNECT", "OK", callback);
  }

  function reassociateCommand(callback) {
    doBooleanCommand("REASSOCIATE", "OK", callback);
  }

  var scanModeActive = false;

  function doSetScanModeCommand(setActive, callback) {
    doBooleanCommand(setActive ? "DRIVER SCAN-ACTIVE" : "DRIVER SCAN-PASSIVE", "OK", callback);
  }

  function scanCommand(forceActive, callback) {
    if (forceActive && !scanModeActive) {
      doSetScanModeCommand(true, function(ok) {
        ok && doBooleanCommand("SCAN", "OK", function(ok) {
          ok && doSetScanModeCommand(false, callback);
        });
      });
      return;
    }
    doBooleanCommand("SCAN", "OK", callback);
  }

  function setScanModeCommand(setActive, callback) {
    sScanModeActive = setActive;
    doSetScanModeCommand(setActive, callback);
  }

  function startDriverCommand(callback) {
    doBooleanCommand("DRIVER START", "OK");
  }

  function stopDriverCommand(callback) {
    doBooleanCommand("DRIVER STOP", "OK");
  }

  function startPacketFiltering(callback) {
    doBooleanCommand("DRIVER RXFILTER-ADD 0", "OK", function(ok) {
      ok && doBooleanCommand("DRIVER RXFILTER-ADD 1", "OK", function(ok) {
        ok && doBooleanCommand("DRIVER RXFILTER-ADD 3", "OK", function(ok) {
          ok && doBooleanCommand("DRIVER RXFILTER-START", "OK", callback)
        });
      });
    });
  }

  function stopPacketFiltering(callback) {
    doBooleanCommand("DRIVER RXFILTER-STOP", "OK", function(ok) {
      ok && doBooleanCommand("DRIVER RXFILTER-REMOVE 3", "OK", function(ok) {
        ok && doBooleanCommand("DRIVER RXFILTER-REMOVE 1", "OK", function(ok) {
          ok && doBooleanCommand("DRIVER RXFILTER-REMOVE 0", "OK", callback)
        });
      });
    });
  }

  function doGetRssiCommand(cmd, callback) {
    doCommand(cmd, function(data) {
      var rssi = -200;

      if (!data.status) {
        // If we are associating, the reply is "OK".
        var reply = data.reply;
        if (reply != "OK") {
          // Format is: <SSID> rssi XX". SSID can contain spaces.
          var offset = reply.lastIndexOf("rssi ");
          if (offset != -1)
            rssi = reply.substr(offset + 5) | 0;
        }
      }
      callback(rssi);
    });
  }

  function getRssiCommand(callback) {
    doGetRssiCommand("DRIVER RSSI", callback);
  }

  function getRssiApproxCommand(callback) {
    doGetRssiCommand("DRIVER RSSI-APPROX", callback);
  }

  function getLinkSpeedCommand(callback) {
    doStringCommand("DRIVER LINKSPEED", function(reply) {
      if (reply)
        reply = reply.split()[1] | 0; // Format: LinkSpeed XX
      callback(reply);
    });
  }

  function getMacAddressCommand(callback) {
    doStringCommand("DRIVER MACADDR", function(reply) {
      if (reply)
        reply = reply.split()[2]; // Format: Macaddr = XX.XX.XX.XX.XX.XX
      callback(reply);
    });
  }

  function setPowerModeCommand(mode, callback) {
    doBooleanCommand("DRIVER POWERMODE " + mode, "OK", callback);
  }

  function getPowerModeCommand(callback) {
    doStringCommand("DRIVER GETPOWER", function(reply) {
      if (reply)
        reply = (reply.split()[2]|0); // Format: powermode = XX
      callback(reply);
    });
  }

  function setNumAllowedChannelsCommand(numChannels, callback) {
    doBooleanCommand("DRIVER SCAN-CHANNELS " + numChannels, "OK", callback);
  }

  function getNumAllowedChannelsCommand(callback) {
    doStringCommand("DRIVER SCAN-CHANNELS", function(reply) {
      if (reply)
        reply = (reply.split()[2]|0); // Format: Scan-Channels = X
      callback(reply);
    });
  }

  function setBluetoothCoexistenceModeCommand(mode, callback) {
    doBooleanCommand("DRIVER BTCOEXMODE " + mode, "OK", callback);
  }

  function setBluetoothCoexistenceScanModeCommand(mode, callback) {
    doBooleanCommand("DRIVER BTCOEXSCAN-" + (mode ? "START" : "STOP"), "OK", callback);
  }

  function saveConfigCommand(callback) {
    // Make sure we never write out a value for AP_SCAN other than 1
    doBooleanCommand("AP_SCAN 1", "OK", function(ok) {
      doBooleanCommand("SAVE_CONFIG", "OK", callback);
    });
  }

  function reloadConfigCommand(callback) {
    doBooleanCommand("RECONFIGURE", "OK", callback);
  }

  function setScanResultHandlingCommand(mode, callback) {
    doBooleanCommand("AP_SCAN " + mode, "OK", callback);
  }

  function addToBlacklistCommand(bssid, callback) {
    doBooleanCommand("BLACKLIST " + bssid, "OK", callback);
  }

  function clearBlacklistCommand(callback) {
    doBooleanCommand("BLACKLIST clear", "OK", callback);
  }

  function setSuspendOptimizationsCommand(enabled, callback) {
    doBooleanCommand("DRIVER SETSUSPENDOPT " + (enabled ? 0 : 1), "OK", callback);
  }

  function getProperty(key, defaultValue, callback) {
    controlMessage({ cmd: "property_get", key: key, defaultValue: defaultValue }, function(data) {
      callback(data.status < 0 ? null : data.value);
    });
  }

  function setProperty(key, value, callback) {
    controlMessage({ cmd: "property_set", key: key, value: value }, function(data) {
      callback(!data.status);
    });
  }

  function enableInterface(ifname, callback) {
    controlMessage({ cmd: "ifc_enable", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function disableInterface(ifname, callback) {
    controlMessage({ cmd: "ifc_disable", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function addHostRoute(ifname, route, callback) {
    controlMessage({ cmd: "ifc_add_host_route", ifname: ifname, route: route }, function(data) {
      callback(!data.status);
    });
  }

  function removeHostRoutes(ifname, callback) {
    controlMessage({ cmd: "ifc_remove_host_routes", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function setDefaultRoute(ifname, route, callback) {
    controlMessage({ cmd: "ifc_set_default_route", ifname: ifname, route: route }, function(data) {
      callback(!data.status);
    });
  }

  function getDefaultRoute(ifname, callback) {
    controlMessage({ cmd: "ifc_get_default_route", ifname: ifname }, function(data) {
      callback(!data.route);
    });
  }

  function removeDefaultRoute(ifname, callback) {
    controlMessage({ cmd: "ifc_remove_default_route", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function resetConnections(ifname, callback) {
    controlMessage({ cmd: "ifc_reset_connections", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function runDhcp(ifname, callback) {
    controlMessage({ cmd: "dhcp_do_request", ifname: ifname }, function(data) {
      callback(data.status ? null : data);
    });
  }

  function stopDhcp(ifname, callback) {
    controlMessage({ cmd: "dhcp_stop", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function releaseDhcpLease(ifname, callback) {
    controlMessage({ cmd: "dhcp_release_lease", ifname: ifname }, function(data) {
      callback(!data.status);
    });
  }

  function getDhcpError(callback) {
    controlMessage({ cmd: "dhcp_get_errmsg" }, function(data) {
      callback(data.error);
    });
  }

  function configureInterface(ifname, ipaddr, mask, gateway, dns1, dns2) {
    controlMessage({ cmd: "configureInterface", ifname: ifname,
                     ipaddr: ipaddr, mask: mask, gateway: gateway,
                     dns1: dns1, dns2: dns2}, function(data) {
      callback(!data.status);
    });
  }

  function runDhcpRenew(ifname, callback) {
    controlMessage({ cmd: "dhcp_do_request", ifname: ifname }, function(data) {
      callback(data.status ? null : data);
    });
  }

  var manager = {};

  function notify(eventName, eventObject) {
    var handler = manager["on" + eventName];
    if (handler) {
      if (!eventObject)
        eventObject = ({});
      handler.call(eventObject);
    }
  }

  // try to connect to the supplicant
  var connectTries = 0;
  var retryTimer = null;
  function connectCallback(ok) {
    if (ok) {
      // tell the event worker to start waiting for events
      retryTimer = null;
      waitForEvent();
      notify("supplicantconnection");
      return;
    }
    if (connectTries++ < 3) {
      // try again in 5 seconds
      if (!retryTimer)
        retryTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

      retryTimer.initWithCallback(function(timer) {
          connectToSupplicant(connectCallback);
        }, 5000, Ci.nsITimer.TYPE_ONE_SHOT);
      return;
    }

    retryTimer = null;
    notify("supplicantlost");
  }

  manager.start = function() {
    connectToSupplicant(connectCallback);
  }

  var supplicantStatesMap = ["DISCONNECTED", "INACTIVE", "SCANNING", "ASSOCIATING",
                             "FOUR_WAY_HANDSHAKE", "GROUP_HANDSHAKE", "COMPLETED",
                             "DORMANT", "UNINITIALIZED"];
  var driverEventMap = { STOPPED: "driverstopped", STARTED: "driverstarted", HANGED: "driverhung" };

  // handle events sent to us by the event worker
  function handleEvent(event) {
    if (event.indexOf("CTRL-EVENT-") != 0) {
      if (event.indexOf("WPA:") == 0 &&
          event.indexOf("pre-shared key may be incorrect") != -1) {
        notify("passwordmaybeincorrect");
      }
      return true;
    }

    var eventData = event.substr(indexOf(" ") + 1);
    if (event.indexOf("CTRL-EVENT-STATE-CHANGE") == 0) {
      // Parse the event data
      var fields = {};
      var tokens = eventData.split(" ");
      for (var n = 0; n < tokens.length; ++n) {
        var kv = tokens[n].split("=");
        if (kv.length == 2)
          fields[kv[0]] = kv[1];
      }
      if (!("state" in fields))
        return true;
      fields.state = supplicantStatesMap[fields.state];
      notify("statechange", fields);
      return true;
    }
    if (event.indexOf("CTRL-EVENT-DRIVER-STATE") == 0) {
      var handlerName = driverEventMap[eventData];
      if (handlerName)
        notify(handlerName);
      return true;
    }
    if (event.indexOf("CTRL-EVENT-TERMINATING") == 0) {
      // If the monitor socket is closed, we have already stopped the
      // supplicant and we can stop waiting for more events and
      // simply exit here (we don't have to notify).
      if (event.indexOf("connection closed") != -1)
        return false;

      // As long we haven't seen too many recv errors yet, we
      // will keep going for a bit longer
      if (event.indexOf("recv error") != -1 && ++recvErrors < 10)
        return true;

      notify("supplicantlost");
      return false;
    }
    if (event.indexOf("CTRL-EVENT-DISCONNECTED") == 0) {
      notify("statechange", { state: "DISCONNECTED" });
      return true;
    }
    if (event.indexOf("CTRL-EVENT-CONNECTED") == 0) {
      // Format: CTRL-EVENT-CONNECTED - Connection to 00:1e:58:ec:d5:6d completed (reauth) [id=1 id_str=]
      var bssid = eventData.split(" ")[4];
      var id = eventData.substr(eventData.indexOf("id=")).split(" ")[0];
      notify("statechange", { state: "CONNECTED", BSSID: bssid, id: id });
      return true;
    }
    if (event.indexOf("CTRL-EVENT-SCAN-RESULTS") == 0) {
      notify("scanresultsavailable");
      return true;
    }
    // unknown event
    return true;
  }

  // Initial state
  var airplaneMode = false;

  // Public interface of the wifi service
  manager.setWifiEnabled = function(enable, callback) {
    var targetState = enable ? "ENABLED" : "DISABLED";
    if (wifiState == targetState)
      return true;
    if (enable && airplaneMode)
      return false;
    if (enable) {
      loadDriver(function (ok) {
        ok ? startSupplicant(callback) : callback(false);
      });
    } else {
      stopSupplicant(function (ok) {
        ok ? unloadDriver(callback) : callback(false);
      });
    }
  }

  manager.disconnect = disconnectCommand;
  manager.reconnect = reconnectCommand;
  manager.reassociate = reassociateCommand;

  var networkConfigurationFields = ["ssid", "bssid", "psk", "wep_key0", "wep_key1", "wep_key2", "wep_key3",
                                    "wep_tx_keyidx", "priority", "scan_ssid"];

  manager.getNetworkConfiguration = function(config, callback) {
    var netId = config.netId;
    var done = 0;
    for (var n = 0; n < networkConfigurationFields; ++n) {
      var fieldName = networkConfigurationFields[n];
      getNetworkVariableCommand(netId, fieldName, function(value) {
        config[fieldName] = value;
        if (++done == networkConfigurationFields.length)
          callback(config);
      });
    }
  }
  manager.setNetworkConfiguration = function(config, callback) {
    var netId = config.netId;
    var done = 0;
    var errors = 0;
    for (var n = 0; n < networkConfigurationFields; ++n) {
      var fieldName = networkConfigurationFields[n];
      if (!(fieldName in config)) {
        ++done;
      } else {
        setNetworkVariableCommand(netId, fieldName, config[fieldName], function(ok) {
          if (!ok)
            ++errors;
          if (++done == networkConfigurationFields.length)
            callback(errors == 0);
        });
      }
    }
    // If config didn't contain any of the fields we want, don't lose the error callback
    if (done == networkConfigurationFields.length)
      callback(false);
  }
  manager.getConfiguredNetworks = function(callback) {
    listNetworksCommand(function (reply) {
      var networks = {};
      var done = 0;
      var errors = 0;
      var lines = reply.split("\n");
      for (var n = 1; n < lines.length; ++n) {
        var result = lines[n].split("\t");
        var netId = result[0];
        var config = networks[netId] = { netId: netId };
        switch (result[3]) {
        case "[CURRENT]":
          config.status = "CURRENT";
          break;
        case "[DISABLED]":
          config.status = "DISABLED";
          break;
        default:
          config.status = "ENABLED";
          break;
        }
        manager.getNetworkConfiguration(config, function (ok) {
            if (!ok)
              ++errors;
            if (++done == lines.length - 1) {
              if (errors) {
                // If an error occured, delete the new netId
                removeNetworkCommand(netId, function() {
                  callback(null);
                });
              } else {
                callback(networks);
              }
            }
        });
      }
    });
  }
  manager.addNetwork = function(config, callback) {
    addNetworkCommand(function (netId) {
      config.netId = netId;
      manager.setNetworkConfiguration(config, callback);
    });
  }
  manager.updateNetwork = function(config, callback) {
    manager.setNetworkConfiguration(config, callback);
  }
  manager.removeNetwork = function(netId, callback) {
    removeNetworkCommand(netId, callback);
  }
  manager.enableNetwork = function(netId, disableOthers, callback) {
    getProperty("manager.interface", "tiwlan0", function (ifname) {
      if (!ifname) {
        callback(false);
        return;
      }
      enableInterface(name, function (ok) {
        if (!ok) {
          callback(false);
          return;
        }
        enableNetworkCommand(netId, disableOthers, function (ok) {
          if (!ok) {
            disableInterface(name, function () {
              callback(false);
            });
          }
          callback(true);
        });
      });
    });
  }
  manager.disableNetwork = function(netId, callback) {
    disableNetworkCommand(netId, callback);
  }
  manager.getMacAddress = getMacAddressCommand;
  return manager;
})();

function nsWifiWorker() {
  WifiManager.onsupplicantconnection = function() {
    debug("Connected to supplicant");
    WifiManager.getMacAddress(function (mac) {
      debug("Got mac: " + mac);
    });
  }
  WifiManager.onsupplicantlost = function() {
    debug("Couldn't connect to supplicant");
  }
  WifiManager.start();

  debug("Wifi starting");
}

nsWifiWorker.prototype = {
  classID:   WIFIWORKER_CID,
  classInfo: XPCOMUtils.generateCI({classID: WIFIWORKER_CID,
                                    contractID: WIFIWORKER_CONTRACTID,
                                    classDescription: "WifiWorker",
                                    interfaces: [Ci.nsIRadioWorker,
                                                 Ci.nsIWifi]}),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIRadioWorker,
                                         Ci.nsIWifi]),

  setWifiEnabled: function(enable) {
    WifiManager.setWifiEnabled(function (ok) {
      debug(ok);
    });
  },

  // This is a bit ugly, but works. In particular, this depends on the fact
  // that RadioManager never actually tries to get the worker from us.
  get worker() { throw "Not implemented"; }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsWifiWorker]);

let debug;
if (DEBUG) {
  debug = function (s) {
    dump("-*- nsWifiWorker component: " + s + "\n");
  };
} else {
  debug = function (s) {};
}
