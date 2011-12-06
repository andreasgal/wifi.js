/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

"use strict";

let libhardware_legacy = (function () {
  let library = ctypes.open("/system/lib/libnetutils.so");

  return {
    ifc_init: library.declare("ifc_init", ctypes.default_abi, ctypes.int),

    ifc_get_ifindex: library.declare("ifc_get_ifindex", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int.ptr),
    ifc_get_hwaddr: library.declare("ifc_get_hwaddr", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.void.ptr),

    ifc_up: library.declare("ifc_up", ctypes.default_abi, ctypes.int, ctypes.char.ptr),
    ifc_down: library.declare("ifc_down", ctypes.default_abi, ctypes.int, ctypes.char.ptr),

    ifc_set_addr: library.declare("ifc_set_addr", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int),
    ifc_set_mask: library.declare("ifc_set_mask", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int),

    ifc_create_default_route: library.declare("ifc_create_default_route", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int),

    ifc_get_info: library.declare("ifc_get_info", ctypes.default_abi, ctypes.int.ptr, ctypes.int.ptr, ctypes.int.ptr)
  };
};
