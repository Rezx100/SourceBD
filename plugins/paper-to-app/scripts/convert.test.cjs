// Offline self-check for convert.cjs: node convert.test.cjs (no Paper, no browser).
// check.cjs is the real proof against Paper; this pins the rules it found.
const assert = require("assert");
const { convert, rewriteClass } = require("./convert.cjs");
const r = (c) => rewriteClass(c, new Set());

assert.equal(r("[color:var(--color-ink-2)]"), "text-ink-2");
assert.equal(r("[border-top-color:var(--color-line)]"), "border-t-line");
assert.equal(r("text-sm/4.5"), "text-sm"); // token line height dropped
assert.equal(r("text-md/5.5"), "text-md/[22px]");
assert.equal(r("text-sm-line-height/6.5"), "text-[18px]/[26px]"); // Paper's 18px font
assert.equal(r("[min-height:48px]"), "min-h-12");
assert.equal(r("pb-26"), "pb-[104px]"); // off the v3 scale
assert.equal(r("border-t-solid"), null);
assert.equal(r("border-b-dashed"), "[border-bottom-style:dashed]");
assert.equal(r("rounded-[calc(infinity*1px)]"), "rounded-full");
assert.equal(r("font-features-['tnum']"), "tabular-nums");
assert.equal(r("wrap-anywhere"), "[overflow-wrap:anywhere]");
assert.equal(r("antialiased"), null);

const board = `(
  <div className="flex w-97.5 h-211 relative flex-col">
    <div className="flex"><div className="text-black">9:41</div></div>
    <div className="text-md/6">Don't "quote" me</div>
    <div className="absolute bottom-0 inset-x-0 h-16"><div>bar</div></div>
  </div>
)`;
const tree = `Frame "Board" (A-0) 390×844
  Frame "Status bar" (B-0) 390×62
    Text "9:41" (C-0) 31×22 "9:41"
  Text "Don't \\"quote\\" me" (D-0) 100×24 "x"
  Frame "Action bar" (E-0) 390×64
    Text "bar" (F-0) 20×20 "bar"`;
const { tsx } = convert(board, { compName: "T", tree });
assert.match(tsx, /className="flex w-full min-h-dvh relative flex-col"/); // phone width and height become the screen's
assert.doesNotMatch(tsx, /9:41/); // status bar gone
assert.match(tsx, /Don&apos;t &quot;quote&quot; me/); // lint-safe copy
assert.match(tsx, /\{\/\* Action bar \*\/\}\n\s*<div className="fixed bottom-0/); // labelled, pinned to the screen
console.log("convert.cjs: all checks pass");
