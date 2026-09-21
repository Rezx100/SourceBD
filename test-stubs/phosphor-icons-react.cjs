"use strict";

// The real package is not loadable under `node --test`, so the suite renders
// icons through this stub. It used to return `null`, which meant every icon
// in the kit emitted nothing at all in every test: the whole of `Icon`'s
// accessible output — `role`, `aria-label`, `aria-hidden` — was invisible to
// the boundary tests, and ten "Remove <filter>" icons shipped as named
// elements with no role because nothing could see them.
//
// It now emits the same shape the real package does: one `<svg>` carrying the
// DOM attributes it was passed. `size` and `weight` are the package's own
// props and are not DOM attributes; everything else passes through.
const { createElement } = require("react");

function Icon(props) {
  const { size, weight, children, ...rest } = props || {};
  void weight;
  const px = typeof size === "number" ? size : 16;
  return createElement(
    "svg",
    { xmlns: "http://www.w3.org/2000/svg", width: px, height: px, viewBox: "0 0 256 256", fill: "currentColor", ...rest },
    children ?? null,
  );
}

module.exports = new Proxy(
  {},
  {
    get: () => Icon,
  },
);
