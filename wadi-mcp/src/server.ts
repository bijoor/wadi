// Wadi MCP server (stdio). Exposes the Wadi house pipeline as agent-native tools
// so a coding agent can author, check, and preview a Wadi DSL (.wdl) design
// WITHOUT the repo checked out and WITHOUT the desktop app running. The examples
// and reference docs are embedded (see assets.generated.ts), so this server is a
// self-contained "Wadi architect over MCP".
//
// stdout is the MCP protocol channel — never write to it. Logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWdl, compileConfig, renderSvgs, rasterize, ALL_VIEWS, type ViewName } from "./pipeline";
import { appReachable, appLoad, appCapture, APP_NOT_RUNNING } from "./appBridge";
import { EXAMPLES, DOCS, MODULES } from "./assets.generated";
import { moduleExports } from "../../wadi-dsl/src/generator/toHouseConfig";

const server = new McpServer({ name: "wadi-mcp", version: "0.1.0" });

// Write a rendered PNG to disk and return its absolute path. So clients that
// can't display inline MCP image content (e.g. LM Studio with a non-vision
// local model) can still open the preview from the returned path. `outDir`
// defaults to a stable folder in the OS temp dir; files are overwritten each
// call, so a re-render updates the same path.
function savePng(buf: Buffer, outDir: string | undefined, name: string): string {
  const dir = outDir && outDir.trim() ? outDir : join(tmpdir(), "wadi-mcp");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, buf);
  return file;
}

// ---- wadi_check --------------------------------------------------------------
server.registerTool(
  "wadi_check",
  {
    title: "Check a Wadi DSL (.wdl) design",
    description:
      "Compile and validate a Wadi DSL house: parse, resolve formulas/grids, then run the real schema + " +
      "wall/roof geometry checks and the structural conventions (plinth height, exterior walls, no-slab " +
      "slab_thickness, floor height = wall + slab). Returns pass/fail with errors and warnings. Run after every edit.",
    inputSchema: { wdl: z.string().describe("The full .wdl source text to check.") },
  },
  async ({ wdl }) => {
    const r = checkWdl(wdl);
    const lines: string[] = [];
    if (r.ok && r.warnings.length === 0) {
      lines.push("✅ Valid — schema + wall/roof geometry + structural conventions OK.");
    } else if (r.ok) {
      lines.push(`✅ Valid, with ${r.warnings.length} convention warning(s) below.`);
    } else {
      lines.push(`❌ Invalid — ${r.errors.length} error(s) below. Fix and re-check.`);
    }
    for (const e of r.errors) lines.push(`  ✖ ${e.rule ? `[${e.rule}] ` : ""}${e.message}`);
    for (const w of r.warnings) lines.push(`  ⚠ ${w.rule ? `[${w.rule}] ` : ""}${w.message}`);
    return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: r };
  },
);

// ---- wadi_preview ------------------------------------------------------------
server.registerTool(
  "wadi_preview",
  {
    title: "Render a Wadi design to images",
    description:
      "Compile a Wadi DSL house and render the requested 2D drawings to PNG images: " +
      "floor plans, elevations (front/back/left/right), and the roof top view. Use it to visually confirm " +
      "room layout, sizes, openings, and roof before telling the user it's ready. Each PNG is BOTH returned " +
      "inline AND written to a file whose absolute path is in the text — so if your client can't display " +
      "inline images, tell the user the path(s) to open.",
    inputSchema: {
      wdl: z.string().describe("The full .wdl source text."),
      views: z
        .array(z.enum(["plans", "elevations", "roof"]))
        .optional()
        .describe("Which drawings to render. Default: all three."),
      width: z.number().int().min(400).max(4000).optional().describe("Raster width in px (default 1600)."),
      out_dir: z
        .string()
        .optional()
        .describe("Absolute directory to save the PNGs to. Default: the OS temp dir. The saved path is returned in the text."),
    },
  },
  async ({ wdl, views, width, out_dir }) => {
    const want = (views && views.length ? views : ALL_VIEWS) as ViewName[];
    let svgs: Array<{ view: ViewName; svg: string }>;
    try {
      svgs = renderSvgs(wdl, want);
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Could not render: " + (e as Error).message + "\nRun wadi_check for the exact problem.",
          },
        ],
        isError: true,
      };
    }
    const content: Array<
      { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
    > = [];
    for (const { view, svg } of svgs) {
      const png = rasterize(svg, width ?? 1600);
      const file = savePng(png, out_dir, `wadi_${view}.png`);
      content.push({ type: "text", text: `— ${view} — saved to: ${file}` });
      content.push({ type: "image", data: png.toString("base64"), mimeType: "image/png" });
    }
    if (!content.length) {
      content.push({
        type: "text",
        text: "No drawings produced (e.g. the roof view needs a roof on the top floor).",
      });
    }
    return { content };
  },
);

// ---- wadi_view_3d (needs the running desktop app) ----------------------------
server.registerTool(
  "wadi_view_3d",
  {
    title: "Show a Wadi design in the live app",
    description:
      "Load a Wadi DSL house into the RUNNING Wadi desktop app's live 3D view, so you and the user " +
      "see the same model (and it updates as you iterate). Requires the Wadi app to be open. For a " +
      "headless image you can look at without the app, use wadi_preview (2D) or wadi_capture_3d (3D).",
    inputSchema: { wdl: z.string().describe("The full .wdl source text.") },
  },
  async ({ wdl }) => {
    let config: unknown;
    try {
      config = compileConfig(wdl);
    } catch (e) {
      return { content: [{ type: "text", text: "❌ Could not compile: " + (e as Error).message }], isError: true };
    }
    if (!(await appReachable())) return { content: [{ type: "text", text: APP_NOT_RUNNING }] };
    try {
      await appLoad(config);
      return { content: [{ type: "text", text: "✅ Loaded into the Wadi app's live 3D view." }] };
    } catch (e) {
      return { content: [{ type: "text", text: "❌ App load failed: " + (e as Error).message }], isError: true };
    }
  },
);

// ---- wadi_capture_3d (needs the running desktop app) -------------------------
server.registerTool(
  "wadi_capture_3d",
  {
    title: "Capture a 3D image of a Wadi design",
    description:
      "Render a Wadi DSL house in the RUNNING Wadi desktop app and return a real 3D PNG — the actual " +
      "textured model, not a 2D drawing. Requires the Wadi app to be open. The PNG is BOTH returned inline " +
      "AND written to a file whose absolute path is in the text (open it if your client can't show inline " +
      "images). (Headless 2D plans/elevations/roof: wadi_preview.)",
    inputSchema: {
      wdl: z.string().describe("The full .wdl source text."),
      out_dir: z
        .string()
        .optional()
        .describe("Absolute directory to save the PNG to. Default: the OS temp dir. The saved path is returned in the text."),
    },
  },
  async ({ wdl, out_dir }) => {
    let config: unknown;
    try {
      config = compileConfig(wdl);
    } catch (e) {
      return { content: [{ type: "text", text: "❌ Could not compile: " + (e as Error).message }], isError: true };
    }
    if (!(await appReachable())) return { content: [{ type: "text", text: APP_NOT_RUNNING }] };
    try {
      const img = await appCapture(config);
      const file = savePng(Buffer.from(img.data, "base64"), out_dir, "wadi_3d.png");
      return {
        content: [
          { type: "text", text: `— 3D view (from the live app) — saved to: ${file}` },
          { type: "image", data: img.data, mimeType: img.mime },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: "❌ 3D capture failed: " + (e as Error).message }], isError: true };
    }
  },
);

// ---- wadi_examples -----------------------------------------------------------
server.registerTool(
  "wadi_examples",
  {
    title: "List or fetch example Wadi designs",
    description:
      "Get validated example .wdl houses to copy from. With no name, lists the examples; with a name, " +
      "returns that example's full .wdl source. Copy from these rather than authoring from memory.",
    inputSchema: {
      name: z
        .string()
        .optional()
        .describe("Example name (minimal | two_room | two_story | coastal | complete). Omit to list."),
    },
  },
  async ({ name }) => {
    if (!name) {
      const list = Object.keys(EXAMPLES)
        .map((n) => `- ${n}`)
        .join("\n");
      return { content: [{ type: "text", text: "Examples (call again with a name):\n" + list }] };
    }
    const src = EXAMPLES[name];
    if (!src) {
      return {
        content: [{ type: "text", text: `No example "${name}". Available: ${Object.keys(EXAMPLES).join(", ")}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: src }] };
  },
);

// ---- wadi_reference ----------------------------------------------------------
server.registerTool(
  "wadi_reference",
  {
    title: "Read Wadi authoring reference docs",
    description:
      "Get the Wadi authoring guide and reference docs (the workflow, DSL syntax, structural conventions, " +
      "coordinate system, parametric conventions, roof guide, and the .wadi data model). With no id, lists " +
      "them; with an id, returns that doc. Read `guide` first, then `dsl` and `conventions`.",
    inputSchema: {
      doc: z
        .string()
        .optional()
        .describe(
          "Doc id (guide | dsl | conventions | coordinate-system | parametric-conventions | roof-v2-guide | data-model). Omit to list.",
        ),
    },
  },
  async ({ doc }) => {
    if (!doc) {
      const list = Object.entries(DOCS)
        .map(([id, d]) => `- ${id} — ${d.title}`)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: "Reference docs (call again with an id):\n" + list + "\n\nStart with `guide`, then `dsl` and `conventions`.",
          },
        ],
      };
    }
    const d = DOCS[doc];
    if (!d) {
      return {
        content: [{ type: "text", text: `No doc "${doc}". Available: ${Object.keys(DOCS).join(", ")}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: d.body }] };
  },
);

// ---- wadi_modules / wadi_module (importable DSL libraries) -------------------
// A word in `q` that matches any of the module's text (summary/asset/component/goal).
function moduleMatchesQuery(name: string, q: string): boolean {
  const mod = MODULES[name];
  const ex = moduleExports(mod.source);
  const hay = [
    name,
    mod.summary,
    ...ex.assets.flatMap((a) => [a.id, a.name ?? "", a.category ?? ""]),
    ...ex.components.flatMap((c) => [c.name, c.goal ?? ""]),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .some((w) => hay.includes(w));
}

server.registerTool(
  "wadi_modules",
  {
    title: "List importable Wadi modules (libraries)",
    description:
      "List the bundled Wadi DSL modules a design can `import` — reusable `.wdl` libraries: asset packs " +
      "(furniture ids for `item`) and component packs (goal-tagged parts for `use`). Each is importable " +
      "by name: `import \"<name>\" as ns`. Pass a `query` to find a module by keyword — including a " +
      "component's GOAL (e.g. \"stairs\" or \"sit-out\") — then call wadi_module for its exports.",
    inputSchema: {
      query: z
        .string()
        .optional()
        .describe("Optional keywords; matches module name/summary, asset ids, and component names + goals."),
    },
  },
  async ({ query }) => {
    let names = Object.keys(MODULES);
    if (!names.length) return { content: [{ type: "text", text: "No modules bundled." }] };
    if (query && query.trim()) names = names.filter((n) => moduleMatchesQuery(n, query.trim()));
    if (!names.length) {
      return { content: [{ type: "text", text: `No modules match "${query}". Try wadi_modules with no query.` }] };
    }
    const list = names.map((n) => `- ${n} — ${MODULES[n].summary}`).join("\n");
    return {
      content: [
        {
          type: "text",
          text:
            (query ? `Modules matching "${query}":\n` : "Importable modules (call wadi_module for exports):\n") +
            list +
            '\n\nThen: `import "<name>" as ns` and `item ns."<asset-id>"` / `use ns.<Component>`.',
        },
      ],
    };
  },
);

server.registerTool(
  "wadi_module",
  {
    title: "Show a Wadi module's exports",
    description:
      "Show what a bundled Wadi module exports so you can use it: ASSETS (ids + real-world dimensions + " +
      "category, placed with `item ns.\"<id>\"`) and COMPONENTS (name + GOAL + params, stamped with " +
      "`use ns.<Name> at (x,y) with { param = … }`). Import first: `import \"<name>\" as ns`. An optional " +
      "query keyword-filters both assets and components (by id/name/category/goal).",
    inputSchema: {
      name: z.string().describe("Module name (e.g. std-furniture, konkan/base). Call wadi_modules to list."),
      query: z.string().optional().describe("Optional keyword to filter exports by id/name/category/goal."),
    },
  },
  async ({ name, query }) => {
    const mod = MODULES[name];
    if (!mod) {
      return {
        content: [{ type: "text", text: `No module "${name}". Available: ${Object.keys(MODULES).join(", ")}` }],
        isError: true,
      };
    }
    const ex = moduleExports(mod.source);
    let assets = ex.assets;
    let components = ex.components;
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      assets = assets.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          (a.category ?? "").toLowerCase().includes(q),
      );
      components = components.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.goal ?? "").toLowerCase().includes(q),
      );
    }
    if (!assets.length && !components.length) {
      return { content: [{ type: "text", text: `Module "${name}": nothing${query ? ` matches "${query}"` : ""}.` }] };
    }
    const lines = [`Module "${name}" — ${mod.summary}`, `Import: \`import "${name}" as ns\``, ""];
    if (components.length) {
      lines.push("Components (use ns.<Name>):");
      for (const c of components) {
        const params = c.params.map((p) => `${p.name}${p.default !== undefined ? `=${p.default}` : ""}`).join(", ");
        lines.push(`  ${c.name}${c.goal ? ` — goal: "${c.goal}"` : ""}${params ? ` (params: ${params})` : ""}`);
      }
      const c0 = components[0];
      const p0 = c0.params[0];
      lines.push(`  e.g. \`use ns.${c0.name} at (x, y)${p0 ? ` with { ${p0.name} = ${p0.default ?? 0} }` : ""}\``, "");
    }
    if (assets.length) {
      const byCat = new Map<string, typeof assets>();
      for (const a of assets) {
        const c = a.category ?? "Other";
        (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(a);
      }
      lines.push("Assets (item ns.\"<id>\"):");
      for (const [cat, items] of byCat) {
        lines.push(`  ${cat}:`);
        for (const a of items) {
          const [w, h, d] = a.dimensions;
          lines.push(`    ${a.id} — ${a.name ?? a.id} (${w}×${h}×${d} m)`);
        }
      }
      lines.push(`  e.g. \`item ns."${assets[0].id}" at (x, y)\` or in a room \`item ns."${assets[0].id}" anchor center\``);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ---- boot --------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  "[wadi-mcp] ready — tools: wadi_check, wadi_preview, wadi_examples, wadi_reference, " +
    "wadi_modules, wadi_module, wadi_view_3d, wadi_capture_3d",
);
