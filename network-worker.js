/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

"use strict";

importScript("libhardware_legacy.js");

var cbuf = ctypes.char.array(4096);
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
  var ret = libhardware_legacy[cmd].call(wifi);
  e.source.postMessage({ id: id, status: ret });
}
