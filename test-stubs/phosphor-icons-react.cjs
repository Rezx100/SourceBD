"use strict";

function Icon() {
  return null;
}

module.exports = new Proxy(
  {},
  {
    get: () => Icon,
  },
);
