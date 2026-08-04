// End-to-end MCP test: spawn the server over stdio and drive it with a real MCP
// client, exercising every tool. Proves the protocol layer, not just the pipeline.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXAMPLES } from "../src/assets.generated.ts";

let failures = 0;
const ok = (cond, msg) => {
  console.error(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};
const textOf = (r) => (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
const imagesOf = (r) => (r.content ?? []).filter((c) => c.type === "image");

const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "src/server.ts"] });
const client = new Client({ name: "wadi-mcp-test", version: "0.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
ok(
  ["wadi_check", "wadi_preview", "wadi_examples", "wadi_reference"].every((n) => tools.some((t) => t.name === n)),
  `tools: ${tools.map((t) => t.name).join(", ")}`,
);

const list = await client.callTool({ name: "wadi_examples", arguments: {} });
ok(textOf(list).includes("coastal"), "wadi_examples (list) includes coastal");

const chkGood = await client.callTool({ name: "wadi_check", arguments: { wdl: EXAMPLES.two_story } });
ok(textOf(chkGood).startsWith("✅"), `wadi_check two_story → ${textOf(chkGood).split("\n")[0]}`);

const badWdl = EXAMPLES.minimal.replace("slab_thickness 0", "slab_thickness 80");
const chkBad = await client.callTool({ name: "wadi_check", arguments: { wdl: badWdl } });
ok(textOf(chkBad).includes("[C3]"), `wadi_check catches C3 → ${textOf(chkBad).split("\n").find((l) => l.includes("C3"))?.trim()?.slice(0, 70)}`);

const prev = await client.callTool({ name: "wadi_preview", arguments: { wdl: EXAMPLES.coastal, views: ["plans"] } });
const imgs = imagesOf(prev);
ok(imgs.length === 1 && imgs[0].mimeType === "image/png" && imgs[0].data.length > 1000, `wadi_preview → ${imgs.length} PNG (${imgs[0] ? Math.round(imgs[0].data.length / 1024) + "KB b64" : "none"})`);

const ref = await client.callTool({ name: "wadi_reference", arguments: { doc: "conventions" } });
ok(textOf(ref).includes("C1") && textOf(ref).includes("C3"), "wadi_reference('conventions') returns the spec");

ok(
  ["wadi_modules", "wadi_module"].every((n) => tools.some((t) => t.name === n)),
  `module tools registered: ${tools.filter((t) => t.name.startsWith("wadi_module")).map((t) => t.name).join(", ")}`,
);

const mods = await client.callTool({ name: "wadi_modules", arguments: {} });
ok(textOf(mods).includes("std-furniture"), "wadi_modules lists std-furniture");

const mod = await client.callTool({ name: "wadi_module", arguments: { name: "std-furniture", query: "bed" } });
ok(textOf(mod).includes("bed_double") && textOf(mod).includes('import "std-furniture"'), `wadi_module('std-furniture', 'bed') → ${textOf(mod).split("\n").find((l) => l.includes("bed_double"))?.trim()?.slice(0, 50)}`);

// a design importing the pack renders through wadi_preview
const furnitureWdl = `house H {
  site { plot (300, 300) }
  import "std-furniture" as f
  floor 1 "G" slab_thickness 0 {
    room Bed at (20, 20) size (160, 200) { wall north east south west
      item f."bed_double" anchor center }
  }
}`;
const impPrev = await client.callTool({ name: "wadi_preview", arguments: { wdl: furnitureWdl, views: ["plans"] } });
ok(imagesOf(impPrev).length === 1, "wadi_preview renders an `import`ing design");

// --- component module (konkan/base) + goal-based discovery ---
const byGoal = await client.callTool({ name: "wadi_modules", arguments: { query: "climb floor" } });
ok(textOf(byGoal).includes("konkan/base"), `wadi_modules query "climb floor" surfaces konkan/base via a component goal`);

const kb = await client.callTool({ name: "wadi_module", arguments: { name: "konkan/base" } });
ok(
  textOf(kb).includes("Stairwell") && textOf(kb).includes("climb to the next floor") && textOf(kb).includes("use ns."),
  `wadi_module('konkan/base') shows Stairwell + its goal → ${textOf(kb).split("\n").find((l) => l.includes("Stairwell"))?.trim()?.slice(0, 60)}`,
);

// a design that `use`s a cross-file component renders through wadi_preview
const compWdl = `house H {
  site { plot (300, 300) }
  import "konkan/base" as kb
  floor 1 "G" slab_thickness 0 {
    room Hall at (20, 20) size (200, 200) { wall north east south west }
    use kb.Stairwell at (60, 60) with { rise = 116 }
  }
}`;
const compChk = await client.callTool({ name: "wadi_check", arguments: { wdl: compWdl } });
ok(textOf(compChk).startsWith("✅"), `wadi_check a design using kb.Stairwell → ${textOf(compChk).split("\n")[0]}`);
const compPrev = await client.callTool({ name: "wadi_preview", arguments: { wdl: compWdl, views: ["plans"] } });
ok(imagesOf(compPrev).length === 1, "wadi_preview renders a design using a cross-file component");

await client.close();
console.error(failures ? `\n✗ ${failures} MCP failure(s)` : "\n✓ all MCP client checks passed");
process.exit(failures ? 1 : 0);
