// Drive a Wadi MCP server that lives OUTSIDE the repo, to prove the bundle is
// self-contained. Uses NO repo imports: it fetches an example .wdl from the
// server's own embedded wadi_examples, then checks + previews it.
//   node standalone-client.mjs <path-to-server.mjs>

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname } from "node:path";

const serverPath = process.argv[2];
if (!serverPath) {
  console.error("usage: node standalone-client.mjs <path-to-server.mjs>");
  process.exit(2);
}
let failures = 0;
const ok = (c, m) => {
  console.error(`${c ? "  ✓" : "  ✗"} ${m}`);
  if (!c) failures++;
};
const textOf = (r) => (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
const imagesOf = (r) => (r.content ?? []).filter((c) => c.type === "image");

// Spawn the bundled server with cwd = its own dir (a temp dir outside the repo).
const transport = new StdioClientTransport({ command: "node", args: [serverPath], cwd: dirname(serverPath) });
const client = new Client({ name: "standalone", version: "0" });
await client.connect(transport);

const { tools } = await client.listTools();
ok(tools.length === 4, `4 tools present: ${tools.map((t) => t.name).join(", ")}`);

const ex = await client.callTool({ name: "wadi_examples", arguments: { name: "coastal" } });
const wdl = textOf(ex);
ok(wdl.includes("house CoastalCottage"), "embedded example served (no repo files)");

const chk = await client.callTool({ name: "wadi_check", arguments: { wdl } });
ok(textOf(chk).startsWith("✅"), `check → ${textOf(chk).split("\n")[0]}`);

const prev = await client.callTool({ name: "wadi_preview", arguments: { wdl, views: ["plans", "roof"] } });
ok(imagesOf(prev).length === 2, `preview → ${imagesOf(prev).length} PNG images`);

await client.close();
console.error(failures ? `\n✗ ${failures} standalone failure(s)` : "\n✓ standalone (no-repo) checks passed");
process.exit(failures ? 1 : 0);
