// Pull Paper boards straight from Paper desktop: Tailwind JSX (what convert.cjs reads),
// inline-styles JSX (the exact values check.cjs compares against), the layer tree, a 1x screenshot, and
// the file's colour tokens as tokens.css.
// usage: node pull.cjs <outDir> <nodeId>[=name] ...
const fs = require("fs");
const path = require("path");
const URL = process.env.PAPER_MCP || "http://127.0.0.1:29979/mcp";
const FILE = process.env.PAPER_FILE || "01M3Z77QNSZKYX715Y21B8RKC2";

let session = null;
let id = 0;
async function rpc(method, params, notify = false) {
  const body = { jsonrpc: "2.0", method, params };
  if (!notify) body.id = ++id;
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify(body),
  });
  session = res.headers.get("mcp-session-id") || session;
  if (notify) return null;
  const text = await res.text();
  const line = text.split("\n").filter((l) => l.startsWith("data:")).pop();
  const msg = JSON.parse(line ? line.slice(5) : text);
  if (msg.error) throw new Error(JSON.stringify(msg.error));
  if (msg.result && msg.result.isError) throw new Error(msg.result.content.map((c) => c.text).join(" "));
  return msg.result;
}
const call = (name, args) => rpc("tools/call", { name, arguments: { fileId: FILE, ...args } });
const jsxOf = (r) => r.content.map((c) => c.text || "").find((s) => s.trim().startsWith("(")) || r.content.map((c) => c.text).join("\n");

(async () => {
  const [outDir, ...targets] = process.argv.slice(2);
  if (!outDir || !targets.length) throw new Error("usage: node pull.cjs <outDir> <nodeId>[=name] ...");
  fs.mkdirSync(outDir, { recursive: true });
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "paper-to-app", version: "1" } });
  await rpc("notifications/initialized", {}, true);
  const tokens = await call("get_tokens", { format: "css", types: ["color"] });
  fs.writeFileSync(path.join(outDir, "tokens.css"), tokens.content.map((c) => c.text).find((t) => t.includes(":root")) || "");
  for (const t of targets) {
    const [nodeId, name = nodeId] = t.split("=");
    const code = jsxOf(await call("get_jsx", { nodeId, format: "tailwind" }));
    fs.writeFileSync(path.join(outDir, `${name}.jsx`), code);
    fs.writeFileSync(path.join(outDir, `${name}.inline.jsx`), jsxOf(await call("get_jsx", { nodeId, format: "inline-styles" })));
    // Layer names ("Compact head", "Tab bar") label the generated code; convert.cjs reads this.
    const tree = await call("get_tree_summary", { nodeId, depth: 10 });
    fs.writeFileSync(path.join(outDir, `${name}.tree.txt`), JSON.parse(tree.content.map((c) => c.text).find((t) => t.includes('"summary"'))).summary);
    const shot = await call("get_screenshot", { nodeId, scale: 1 });
    const img = shot.content.find((c) => c.type === "image");
    const ext = img && /png/.test(img.mimeType) ? "png" : "jpg";
    if (img) fs.writeFileSync(path.join(outDir, `${name}.paper.${ext}`), Buffer.from(img.data, "base64"));
    console.log(`${name}: ${code.length} chars${img ? ` + ${ext}` : ""}`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
