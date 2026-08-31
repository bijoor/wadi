# Remote MCP server for Wadi (scoping)

Status: scoping only, no build yet. Decision doc before any code.

## Goal

Expose Wadi's `.wdl` tools as a **remote MCP server over HTTP** at a public URL, so
agents that connect to remote MCP servers by URL can author Wadi houses directly,
with no browser extension and none of the WebMCP consumer-side gating we hit with
Claude for Chrome.

Clients this unlocks (all use the same remote-MCP-over-HTTP shape):
- **Gemini** — Connected Apps: `gemini.google.com/apps` → "Add a custom app" → paste
  the MCP server URL. Optional OAuth Dynamic Client Registration; else the user
  supplies credentials. English-only, Gemini Spark (mobile + web) for now.
  (Source: Google support 17209137.)
- **Claude.ai** custom connectors (Pro/Team/Enterprise), and **ChatGPT** MCP.
- Any MCP client that accepts a remote server URL.

This is the third and most robust agent surface. It is NOT the in-page
`window.wadi` / WebMCP path (that drives the live tab, but the consumer side is
gated), and NOT the local stdio `wadi-mcp` (coding agents like Claude Code). It is
the same tool logic as `wadi-mcp`, hosted behind HTTP.

## What already exists (so this is mostly a transport swap)

`wadi-mcp/src/server.ts` builds an `McpServer` (`@modelcontextprotocol/sdk`) and
registers the tools with `server.registerTool(...)`, today bound to
`StdioServerTransport`. The MCP SDK also ships `StreamableHTTPServerTransport`. So
the server core (tools + handlers) is unchanged; the new work is:

1. mount those tools on the Streamable HTTP transport,
2. host it at a public URL,
3. adapt the 2D rasteriser to the host (see Rendering), and
4. give the agent a way to hand the finished WDL back to the app (see Handoff).

Existing tools (reuse as-is): `wadi_reference`, `wadi_examples`, `wadi_check`,
`wadi_scope`, `wadi_preview` (2D), `wadi_modules`, `wadi_module`, `wadi_glb_inspect`,
`wadi_view_3d`, `wadi_capture_3d`.

## Transport

- **Streamable HTTP** (current MCP remote transport): a single endpoint (e.g.
  `POST /mcp`) with optional SSE streaming for progress. The SDK's
  `StreamableHTTPServerTransport` implements it.
- **Stateless.** Each tool call carries the full `.wdl` as input (the agent holds the
  current document and passes it every call). No server-side session or per-user
  state. This is the standard remote-MCP pattern and keeps hosting trivial and safe.
- CORS + the MCP protocol/version headers per spec.

## Tools (the stateless authoring loop)

Same names/handlers as `wadi-mcp`, all taking `wdl` as input where relevant:

- `wadi_reference` — the `.wdl` primer/reference (keep in sync with the in-app
  `WDL_PRIMER` / `window.wadi.help()` / `docs/llms.txt` — one source of truth).
- `wadi_examples` — full valid example houses to copy from.
- `wadi_check(wdl)` — compile + schema + the C1-C12 structural check; returns errors
  and warnings. The core validate loop.
- `wadi_scope(wdl)` — resolved variables / points / grid lookup.
- `wadi_preview(wdl, view?)` — render a **2D** view (plan / elevation / roof /
  dimensioned) to PNG and return it as image content.
- `wadi_view_3d(wdl)` — a **3D** render to PNG (see Rendering; host-dependent).
- `wadi_open_in_app(wdl)` — return a URL that opens this WDL in the full app (Handoff).

## Rendering (the host-deciding constraint)

- 2D previews use `@resvg/resvg-js` (a NATIVE Node binding) in `wadi-mcp/pipeline.ts`.
  On Cloudflare Workers there are no native modules; swap to `@resvg/resvg-wasm`.
  The compile/check/geometry pipeline (Langium + the `editor/src` pipeline) is pure
  JS/TS and runs on Workers. So **2D previews are feasible on Workers.**
- 3D renders need GL (headless-gl / a browser). That does **not** run on Cloudflare
  Workers. 3D previews therefore require a Node host (or a separate render worker).

## Hosting options

**A. Cloudflare Worker at `mcp.wadi.house`** (recommended first version)
- Aligns with the existing Cloudflare Pages + wrangler setup and the "low-infra,
  billing-safe" constraint (see the CI/hosting migration memory).
- Ships check / reference / examples / scope + **2D** previews (resvg-wasm).
- 3D deferred.
- Cloudflare has first-class remote-MCP support (Workers + the agents SDK), so the
  Streamable HTTP wiring is well-trodden.

**B. Node host (Fly.io / Render / small VPS)**
- Keeps `@resvg/resvg-js` and enables **3D** renders.
- New infra to provision, pay for, and keep alive; more moving parts.

Recommendation: A now (Worker, 2D), add 3D later via B or a dedicated render worker
if 3D previews prove worth it.

## Auth

The tools operate only on WDL passed in the request: no user data, no persistence.
So **public, no auth** is the simplest correct choice. Gemini's Dynamic Client
Registration is optional and unneeded here. Protect with Cloudflare rate limiting.
(If a future version holds per-user state or writes to a user's storage, revisit
with OAuth DCR.)

## Handoff: getting the authored WDL into the app

The server is stateless and not tied to any open tab, so "author here, view in the
app" needs an explicit bridge. Options, cheapest first:

1. **Open-in-app URL** — `wadi_open_in_app` returns a link the user clicks to load
   the WDL in the full app. Reuse the existing share-link encoding
   (`#w1=…`, commit c79c545) or a fresh `?wdl=` param. NOTE: verify the share-link
   DECODE path first — there is a known viewer gunzip bug
   (`Response(blob.stream())` "Failed to fetch", see the share/open-in-app memory).
   Fix or route around it before relying on this.
2. **Return the `.wdl` text** — the agent shows it; the user saves it and opens it in
   the app (drag-drop / Open). Always works, no link needed.
3. **Future live bridge (Phase 2)** — a session code the viewer subscribes to (socket
   / durable object) so the remote server pushes updates to a specific open tab. This
   is the "agent co-designs your live model from Gemini" dream. Much bigger:
   session correlation, a persistent channel, auth. Out of scope for v1.

## Phasing

- **v1 (Worker, stateless, 2D):** Streamable HTTP transport + the reuse tools +
  resvg-wasm 2D previews + `wadi_open_in_app` returning a link (once the decode path
  is verified) and/or the raw `.wdl`. Deploy to `mcp.wadi.house`. Document the Gemini
  "Add a custom app" steps in the README.
- **v1.1:** 3D previews (Node host or render worker) if wanted.
- **v2:** live-tab bridge (Phase 2 above).

## Open decisions

1. Host: Cloudflare Worker (2D) vs Node (3D) for v1. (Recommend Worker.)
2. Handoff: fix the share-link decode bug and use open-in-app links, or start with
   returning raw `.wdl`. (Recommend: return `.wdl` immediately; add the link once
   decode is verified.)
3. Domain: `mcp.wadi.house` (needs a DNS record + a Worker route).
4. Keep the reference/primer text single-sourced across `wadi_reference`,
   `window.wadi.help()`, and `docs/llms.txt` so they never drift.

## Related

- Local stdio server + tools: `wadi-mcp/` (the code we reuse).
- In-page path: `window.wadi` + WebMCP (`wireWebMcpTools`), `docs/llms.txt`.
- Handoff/share: share-link + open-in-app (and its decode bug).
