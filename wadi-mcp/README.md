# wadi-mcp

An **MCP server** that exposes the Wadi house pipeline as agent-native tools, so a
coding agent can author, check, and preview a **Wadi DSL (`.wdl`)** design **without the
repo checked out and without the desktop app running**. The DSL compiler, the schema +
wall/roof geometry, the structural-conventions linter, the 2D renderers, and the example
+ reference docs are all bundled in — the only external runtime dependency is the native
SVG rasteriser (`@resvg/resvg-js`).

This is the repo-free way to run the [Wadi architect skill](../wadi-skill/architect/).
(The `wadi-skill` scripts — `check.sh` / `preview.sh` — do the same thing but need the
repo; this server replaces them for agents that speak MCP.)

## Tools

| Tool | What it does |
| --- | --- |
| `wadi_check` | Compile + validate a `.wdl`: parse, resolve formulas/grids, schema + wall/roof geometry, and the structural conventions (C1/C2/C3). Returns pass/fail + errors/warnings. **Run after every edit.** |
| `wadi_preview` | Render a `.wdl` to **PNG images** you can look at — floor plans, elevations, roof top view. Confirm layout/sizes/openings/roof visually. |
| `wadi_examples` | List, or fetch the full source of, a validated example `.wdl` (`minimal` / `two_room` / `two_story` / `coastal` / `complete`). Copy from these. |
| `wadi_reference` | The authoring docs, embedded: `guide`, `dsl`, `conventions`, `coordinate-system`, `parametric-conventions`, `roof-v2-guide`, `data-model`. |

## Run it

From a checkout (dev):

```bash
npm install
npm run dev          # stdio MCP server (gen-assets + tsx src/server.ts)
```

Self-contained bundle (no repo afterwards):

```bash
npm run build        # → dist/server.mjs (everything inlined except @resvg/resvg-js)
```

`dist/server.mjs` runs anywhere Node ≥20 is available, with only `@resvg/resvg-js`
installed alongside it.

## Register with an agent

**Published to npm — zero install** (nothing to build or clone; `npx` fetches on first run):

```bash
claude mcp add wadi -- npx -y wadi-mcp        # Claude Code
```
```json
{ "mcpServers": { "wadi": { "command": "npx", "args": ["-y", "wadi-mcp"] } } }
```

**From a local build** (`npm run build` above) — point at the bundle by path:

```json
{ "mcpServers": { "wadi": { "command": "node", "args": ["/abs/path/to/wadi-mcp/dist/server.mjs"] } } }
```

**Any MCP client** (Cursor, Windsurf, Claude Desktop, …) — use the same `command` + `args`
(stdio transport). Then ask the agent to design a house; it calls
`wadi_reference('guide')` to learn the workflow, `wadi_examples` to copy a starting
point, and `wadi_check` / `wadi_preview` as it authors the `.wdl`.

> The agent still writes a `.wdl` file you both co-edit; for the **live** 3D preview, open
> that file in the Wadi DSL editor (desktop ⌘⇧D, or <https://wadi.house/dsl>). This server
> provides the headless check + 2D image previews the agent reads on its own.

## Verify

```bash
npm run smoke                              # in-process pipeline (check + render)
npx tsx scripts/client-test.mjs            # end-to-end over the MCP protocol
# no-repo proof: build, copy dist/server.mjs to a temp dir, `npm i @resvg/resvg-js`, then
npx tsx scripts/standalone-client.mjs <temp>/server.mjs
```

## How it stays in sync

The server imports the **real** pipeline from `editor/src` and `wadi-dsl/src` (see
`src/pipeline.ts`), so `wadi_check`/`wadi_preview` match the app byte-for-byte — there is
no second implementation to drift. `scripts/gen-assets.mjs` re-embeds the examples and
reference docs at build time. Rebuild (`npm run build`) after changing the schema, the
DSL, the conventions, or the docs.

## Publishing

`npm publish` (from `wadi-mcp/`). `prepublishOnly` runs `build` + `smoke` first, so the
published tarball always contains a freshly-bundled, tested `dist/server.mjs` (the only
files shipped are `dist/` + `package.json` + this README). Bump `version` first.

_Phase 2: the Tauri desktop app hosts extra tools — `wadi_view_3d` / `wadi_capture_3d` —
that reuse its live renderer, so an agent can load a design into the open app and get a
real **3D** capture, not just 2D drawings._
