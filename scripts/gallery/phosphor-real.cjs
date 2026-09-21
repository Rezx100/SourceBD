"use strict";
// The kit's icon imports resolve here during a gallery render. The real
// Phosphor set is ESM only, so it is loaded once by the harness into
// `globalThis.__PHOSPHOR__` and each icon is looked up when it renders.
const React = require("react");
module.exports = new Proxy(
  {},
  {
    get: (_target, name) =>
      function LateBoundIcon(props) {
        const set = globalThis.__PHOSPHOR__;
        const Icon = set && set[name];
        return Icon ? React.createElement(Icon, props) : null;
      },
  },
);
