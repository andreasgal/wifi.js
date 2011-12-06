/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

"use strict";

importScript("libhardware_legacy.js");
importScript("libnetutils.js");
importScript("libcutils.js");

var cbuf = ctypes.char.array(4096);
var hwaddr = ctypes.uint8_t.array(6);
var len = ctypes.size_t();
var ints = ctypes.int.array(8);

function onmessage(e) {
  var data = e.data;
  var id = data.id;
  var cmd = data.cmd;

  var source = e.source;
  if (cmd == "command") { // command(cmd)
    len.value = 4096;
    var ret = libhardware_legacy.command(data.request, cbuf, len.ptr);
    var reply = "";
    if (!ret) {
      var reply_len = len.value;
      var str = cbuf.readString();
      if (str[reply_len-1] == "\n")
        --reply_len;
      reply = str.substr(reply_len);
    }
    source.postMessage({ id: id, status: ret, reply: reply });
    return;
  }
  if (cmd == "wait_for_event") { // wait_for_event(buf, len)
    var ret = libhardware_legacy.wait_for_event(cbuf, 4096);
    var event = cbuf.readString().substr(ret);
    source.postMessage({ id: id, event: event });
    return;
  }
  if (cmd == "ifc_enable" || cmd == "ifc_disable" || cmd == "ifc_remove_host_routes" ||
      cmd == "ifc_remove_default_route" || cmd == "ifc_reset_connections" ||
      cmd == "dhcp_stop" || cmd == "dhcp_release_lease") {
    var ret = libnetutils[cmd](data.ifname);
    source.postMessage({ id: id, status: ret });
    return;
  }
  if (cmd == "ifc_get_default_route") {
    var route = libnetutils.ifc_get_default_route(data.ifname);
    source.postMessage({ id: id, route: route });
    return;
  }
  if (cmd == "ifc_add_host_route" || cmd == "ifc_set_default_route") {
    var ret = libnetutils[cmd](data.ifname, data.route);
    source.postMessage({ id: id, status: ret });
    return;
  }
  if (cmd == "ifc_configure") {
    var ret = libnetutils.ifc_configure(data.ifname, data.ipaddr, data.netmask, data.gateway, data.dns1, data,dns2);
    source.postMessage({ id: id, status: ret });
    return;
  }
  if (cmd == "dhcp_get_errmsg") {
    var error = libnetutils.get_dhcp_get_errmsg();
    source.postMessage({ id: id, error: error.readString() });
    return;
  }
  if (cmd == "dhcp_do_request" || cmd == "dhcp_do_request_renw") {
    var ret = libnetutils[cmd](data.ifname,
                               ints.addressOfElement(0),
                               ints.addressOfElement(1),
                               ints.addressOfElement(2),
                               ints.addressOfElement(3),
                               ints.addressOfElement(4),
                               ints.addressOfElement(5),
                               ints.addressOfElement(6));
    source.postMessage({ id: id, status: ret, ipaddr: ints[0], gateway: ints[1], mask: ints[2],
                         dns1: ints[3], dns2: ints[4], server: ints[5], lease: ints[6]});
    return;
  }
  if (cmd == "property_get") {
    var ret = libcutils.property_get(data.key, cbuf, data.defaultValue);
    source.postMessage({ id: id, status: ret, value: cbuf.readString() });
    return;
  }
  if (cmd == "property_set") {
    var ret = libctils.property_set(data.key, data.value);
    source.postMessage({ id: id, status: ret });
    return;
  }
  var f = libhardware_legacy[cmd] || libnetutils[cmd];
  var ret = f.call(wifi);
  source.postMessage({ id: id, status: ret });
}
