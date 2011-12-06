/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

"use strict";

let libhardware_legacy = (function () {
  let library = ctypes.open("/system/lib/libnetutils.so");

  return {
    ifc_enable: library.declare("ifc_enable", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_disable: library.declare("ifc_disable", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_add_host_route: library.declare("ifc_add_host_route", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int),
    ifc_remove_host_routes: library.declare("ifc_remove_host_routes", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_set_default_route: library.declare("ifc_set_default_route", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int),
    ifc_get_default_route: library.declare("ifc_get_default_route", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_remove_default_route: library.declare("ifc_remove_default_route", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_reset_connections: library.declare("ifc_reset_connections", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_configure: library.declare("ifc_configure", ctypes.default_abi, ctypes.int, ctypes.char.ptr,
                                   ctypes.int, ctypes.int, ctypes.int, ctypes.int, ctypes.int)
  };
};
