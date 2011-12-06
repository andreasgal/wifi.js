/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

"use strict";

importScript("libhardware_legacy.js");

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
  if (cmd == "do_dhcp_request") {
    var ret = libhardware_legacy.do_dhcp_request(ints.addressOfElement(0),
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
  if (cmd == "get_dhcp_error_string") {
    var error = libhardware_legacy.get_dhcp_error_string();
    source.postMessage({ id: id, error: error.readString() });
    return;
  }
  if (cmd == "ifc_get_ifindex") {
    var ret = libnetutils.ifc_get_ifindex(data.name, ints.addressOfElement(0));
    source.postMessage({ id: id, status: ret, ifindex: ints[0] });
    return;
  }
  if (cmd == "ifc_get_hwaddr") {
    var ret = libnetutils.ifc_get_hwaddr(data.name, hwaddr);
    source.postMessage({ id: id, status: ret, [hwaddr[0], hwaddr[1], hwaddr[2],
                                               hwaddr[3], hwaddr[4], hwaddr[5]] });
    return;
  }
  if (cmd == "ifc_up" || cmd == "ifc_down") {
    var ret = libnetutils[cmd].call(data.name);
    source.postMessage({ id: id, status: ret });
    return;
  }
  if (cmd == "ifc_set_addr" || cmd == "ifc_set_mask" || cmd == "ifc_set_default_route") {
    var ret = libnetutils[cmd].call(data.name, data.value);
    source.postMessage({ id: id, status: ret });
    return;
  }
  if (cmd == "ifc_get_info") {
    var ret = libnetutils.ifc_get_info(data.name, ints.addressOfElement(0), ints.addressOfElement(1), ints.addressOfElement(2));
    source.postMessage({ id: id, status: ret, addr: ints[0], mask: ints[1], flags: ints[2] });
    return;
  }
  var f = libhardware_legacy[cmd] || libnetutils[cmd];
  var ret = f.call(wifi);
  source.postMessage({ id: id, status: ret });
}
