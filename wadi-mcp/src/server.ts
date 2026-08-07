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
      "textured model, not a 2D drawing. Requires the Wadi app to be open.\n" +
      "CAMERA: pass `room` (a room name, e.g. \"Bedroom\") for a first-person INTERIOR look (best for checking " +
      "furniture placement/orientation), OR `camera` for a named EXTERIOR angle (iso | front | back | left | " +
      "right | top). Omit both for the current outside orbit.\n" +
      "LAYERS: pass `isolate` (a list of layer ids/labels) to show ONLY those, or `layers` (a map of id/label → " +
      "on/off) to toggle specific ones — e.g. isolate the structure to shoot the frame, or hide the roof to see " +
      "the plan of walls. The response lists every available layer (id + label) so you can refine a follow-up " +
      "shot. Layer changes are restored after the capture.\n" +
      "The PNG is BOTH returned inline AND written to a file whose path is in the text. " +
      "(Headless 2D plans/elevations/roof: wadi_preview.)",
    inputSchema: {
      wdl: z.string().describe("The full .wdl source text."),
      room: z
        .string()
        .optional()
        .describe("A room name (as written in the .wdl) to view from INSIDE (first-person). Takes precedence over `camera`."),
      camera: z
        .enum(["iso", "front", "back", "left", "right", "top"])
        .optional()
        .describe("A named EXTERIOR camera angle. Ignored if `room` is given. Omit for the current outside orbit."),
      isolate: z
        .array(z.string())
        .optional()
        .describe("Show ONLY these layers (ids or labels, case-insensitive); hide all others. See the returned layer list."),
      layers: z
        .record(z.string(), z.boolean())
        .optional()
        .describe('Toggle specific layers by id or label, e.g. { "Roof": false, "Structure": true }.'),
      out_dir: z
        .string()
        .optional()
        .describe("Absolute directory to save the PNG to. Default: the OS temp dir. The saved path is returned in the text."),
    },
  },
  async ({ wdl, room, camera, isolate, layers, out_dir }) => {
    let config: unknown;
    try {
      config = compileConfig(wdl);
    } catch (e) {
      return { content: [{ type: "text", text: "❌ Could not compile: " + (e as Error).message }], isError: true };
    }
    if (!(await appReachable())) return { content: [{ type: "text", text: APP_NOT_RUNNING }] };
    try {
      const view = { room, camera, isolate, layers };
      const hasView = room || camera || isolate?.length || (layers && Object.keys(layers).length);
      const img = await appCapture(config, hasView ? view : undefined);
      const slug = room
        ? `wadi_3d_${room.replace(/\W+/g, "_")}`
        : camera
          ? `wadi_3d_${camera}`
          : "wadi_3d";
      const file = savePng(Buffer.from(img.data, "base64"), out_dir, `${slug}.png`);
      const label = room
        ? `3D interior view of "${room}"`
        : camera
          ? `3D exterior view (${camera})`
          : "3D view (outside orbit)";
      const shown = isolate?.length ? ` · showing only: ${isolate.join(", ")}` : "";
      const layerList = img.layers?.length
        ? "\nAvailable layers (id — label): " +
          img.layers.map((l) => `${l.id} — ${l.label}`).join(" · ") +
          "\nPass `isolate` or `layers` (id or label) to control what's visible."
        : "";
      return {
        content: [
          { type: "text", text: `— ${label}${shown} (from the live app) — saved to: ${file}${layerList}` },
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
        .describe(
          "Example name (minimal | two_room | two_story | coastal | complete | konkan_cottage). " +
            "konkan_cottage shows `import`ing the furniture + konkan/base packs. Omit to list.",
        ),
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
      lines.push(
        `  Orientation: a piece's front faces SOUTH at rotation 0 (90=East, 180=North, 270=West). ` +
          `ANCHORING auto-orients — an anchored piece with no rotation faces into the room (anchor ` +
          `top-center→south, bottom-center→north, center-left→east, center-right→west); an explicit ` +
          `rotation overrides. wadi_preview plans draws a front-notch; wadi_capture_3d({room}) shows it from inside.`,
      );
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// ---- wadi_glb_inspect --------------------------------------------------------
// Rigs target GLB nodes BY NAME (`translate "nodeName" (…)`), so an author must
// know the names inside a .glb before writing a `model { … }` rig. This reads
// the GLB's glTF JSON and lists its named nodes, meshes, and materials.
server.registerTool(
  "wadi_glb_inspect",
  {
    title: "List the named nodes of a GLB",
    description:
      "Inspect a .glb (binary glTF) and list the NAMED nodes, meshes, and materials it contains. Use this " +
      "before writing a `model { … }` rig: the rig manipulates the GLB by node name (translate/rotate/scale/" +
      'visible/material "nodeName"). Give a `url` (http/https, fetched) or a local `path`. Returns the names ' +
      "to target plus the scene roots.",
    inputSchema: {
      url: z.string().optional().describe("http(s) URL of the .glb to fetch and inspect."),
      path: z.string().optional().describe("Local filesystem path of a .glb (alternative to url)."),
    },
  },
  async ({ url, path }) => {
    let bytes: Uint8Array;
    try {
      if (url && url.trim()) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
        bytes = new Uint8Array(await res.arrayBuffer());
      } else if (path && path.trim()) {
        const { readFileSync } = await import("node:fs");
        bytes = readFileSync(path);
      } else {
        return { content: [{ type: "text", text: "Provide a `url` or a `path` to a .glb." }], isError: true };
      }
    } catch (e) {
      return { content: [{ type: "text", text: `Could not load the GLB: ${(e as Error).message}` }], isError: true };
    }

    let info;
    try {
      const { inspectGlb } = await import("./glb");
      info = inspectGlb(bytes);
    } catch (e) {
      return { content: [{ type: "text", text: `Not a readable GLB: ${(e as Error).message}` }], isError: true };
    }

    const lines: string[] = [];
    lines.push(
      `GLB has ${info.nodeCount} node(s): ${info.nodes.length} named, ${info.unnamedNodeCount} unnamed (unnamed nodes cannot be rig-targeted).`,
    );
    if (info.nodes.length) {
      lines.push("", "Named nodes (rig target these):");
      for (const n of info.nodes) {
        const kids = n.children.length ? ` [${n.children.length} child node(s)]` : "";
        const mesh = n.mesh ? ` · mesh "${n.mesh}"` : "";
        lines.push(`  "${n.name}"${mesh}${kids}`);
      }
    }
    if (info.meshes.length) lines.push("", `Meshes: ${info.meshes.map((m) => `"${m}"`).join(", ")}`);
    if (info.materials.length)
      lines.push("", `Materials (recolor with \`material "node" color "#…"\`): ${info.materials.map((m) => `"${m}"`).join(", ")}`);
    lines.push(
      "",
      'Example rig — `model asset { … } at (x,y) { rotate "' + (info.nodes[0]?.name ?? "nodeName") + '" (0, 45, 0) }`',
    );
    return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: info };
  },
);

// ---- boot --------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  "[wadi-mcp] ready — tools: wadi_check, wadi_preview, wadi_examples, wadi_reference, " +
    "wadi_modules, wadi_module, wadi_view_3d, wadi_capture_3d, wadi_glb_inspect",
);
