# Remote MCP server for Wadi

Status: **v1 SHIPPED** (2026-08-31) — hosted at `https://mcp.wadi.house/mcp` on a
Cloudflare Container (not a Worker: the tool pipeline statically pulls in React-Three,
so a pure Worker would need a headless refactor; the Container runs the existing 16MB
Node bundle unchanged). Stateless Streamable HTTP; 8 repo-free tools (check, scope,
preview[2D inline PNG], examples, reference, modules, module, glb_inspect); the two
app-bridge tools stay stdio-only. Handoff is copy-paste (decided). Code in `wadi-mcp/`
(`src/http.ts`, `src/worker.ts`, `Dockerfile`, `wrangler.jsonc`); deploy via
`npm --prefix wadi-mcp run cloud:deploy`. Phase 2 (live co-editing relay) below is the
remaining work.

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
gated), and NOT the local stdio `wadi-mcp` (coding agents like Claude Code and
Antigravity). It is the same tool logic as `wadi-mcp`, hosted behind HTTP.

**The offline server stays.** We keep publishing and supporting the local stdio
`wadi-mcp` for agents that run one locally (Claude Code, Antigravity, Claude
Desktop). The online server is additive: it broadens the set of agents that can
author Wadi files (Gemini, Claude.ai web connectors, ChatGPT) without anyone
hosting anything, which is the point. Same tool logic, two transports.

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

1. **Copy-paste the WDL text (the v1 handoff — DECIDED).** The agent returns the WDL;
   the user pastes it into the app's always-on WDL editor and hits Apply. It compiles
   and renders in place (no reload, camera preserved), and Save then writes a proper
   `.wadi`. Works today with zero new plumbing. Note the app does NOT open a raw `.wdl`
   FILE (only `.wadi` / legacy JSON), so this is paste-into-the-editor, not
   save-a-file-and-open-it — and loose `.wdl` files are being deprecated anyway.
2. **Open-in-app URL (deferred, not needed for v1).** `wadi_open_in_app` returns a
   link that opens the app with the WDL loaded (reuse the `#w1=…` share encoding,
   commit c79c545, or a fresh `?wdl=` param). Downsides that make it worse than paste
   for iteration: each edit needs a NEW link and a click, and clicking RELOADS (loses
   view state, spawns tabs); it also depends on first fixing the known share-link
   DECODE bug (`Response(blob.stream())` "Failed to fetch", see the share/open-in-app
   memory). Skip for v1; revisit only if a one-click first-open is wanted.
3. **Live co-editing** — the session-relay bridge, fully specified as Phase 2 below.
   This is what actually removes the per-edit manual step; the v1 copy-paste is its
   manual precursor.

## Phase 2 — live co-editing bridge (session relay)

**Why it is needed, and why it is a bridge.** A cloud-document product (Canva,
Figma, Google Docs) keeps the document on the vendor's server, so every client —
the app, a collaborator, an agent — is a view onto one server-side document and
live collaboration is free. Wadi deliberately chose the opposite: the USER owns the
file, so there is no shared server-side document for a remote agent to attach to.
To let a remote agent co-edit the model the user is watching in the app, we bridge
them with a short-lived session relay: a temporary online copy of the WDL that the
app and the agent both attach to while editing, then hand back to the user's own
storage.

**Principles (these are what keep local-first intact):**
- **A relay, not a store.** The session holds only the current WDL text plus a little
  session metadata. It is transient scaffolding, not a Wadi account or permanent
  cloud storage. The user's file stays the system of record. This is the line that
  separates the bridge from turning Wadi into a cloud app.
- **The app owns persistence, not the agent.** The agent edits the live relay; only
  the app, acting for the user, writes to the user's destination (a local `.wadi`, or
  their cloud sync folder). The agent never touches the user's storage.
- **Ephemeral and gated.** Session-id gated (the unguessable id is the capability),
  auto-expiring on idle, deleted after save or timeout, no account. The WDL does sit
  on our relay during the session, so strict transience is what keeps the trade
  honest for users who chose local ownership for privacy.
- **Opt-in and additive.** The relay only exists when a user explicitly wants a
  remote agent to co-edit live. Every pure-local path (author in-app, local stdio
  server) stays and needs none of this.

**Flow:**
1. In the app the user picks "Co-edit with an agent" → the app creates a session
   (a Cloudflare Durable Object) and gets a session id + short link.
2. The user hands the id/link to the agent (paste it, or the agent opens the link).
   The agent connects through the MCP server's session-scoped tools.
3. Both edit the same session WDL. The app subscribes (WebSocket, or SSE) and
   live-renders every change; simple whole-document last-write-wins for v1.
4. When done, the app saves to the user's destination and the session copy expires.

**Technical shape:**
- One **Cloudflare Durable Object per session id** holds the WDL and a pub/sub of the
  connected clients (the app + the agent). Workers' hibernatable WebSockets (or SSE)
  carry live updates to the app.
- The MCP server gains **session-scoped tools** alongside the stateless ones:
  `wadi_session_open()` (mint a session, or the app mints it and the agent is given
  the id), `wadi_session_get(session)`, `wadi_session_set(session, wdl)` — read/write
  the DO. The stateless `wadi_check` / `wadi_preview` still take `wdl` inline.
- The **app gains a "connect to session" mode**: given a session id, open a socket to
  the DO, apply incoming WDL to the live model, and push the user's own edits back.
- **Auth:** the session id is the capability; optionally bind a session to the app
  instance that created it so only that app can save.

**Conflict semantics (v1):** whole-document last-write-wins, with a small "agent is
editing" indicator in the app; the human can take over and their save wins. CRDT /
range merge deferred.

**Persistence + privacy:** on save the app writes the `.wadi` to the user's location
and the DO is deleted; idle sessions auto-expire (e.g. 30-60 min). No content is
retained after the session ends.

## Phasing

- **v1 (Worker, stateless, 2D):** Streamable HTTP transport + the reuse tools +
  resvg-wasm 2D previews. Handoff = the agent returns the WDL, the user copy-pastes it
  into the app's WDL editor (no open-in-app link in v1 — see Handoff). Deploy to
  `mcp.wadi.house`. Document the Gemini "Add a custom app" steps in the README. The
  local stdio `wadi-mcp` keeps shipping unchanged.
- **v1.1:** 3D previews (Node host or render worker) if wanted.
- **v2 (live co-editing):** the session-relay bridge above — Durable Object session
  store, session-scoped MCP tools, and the app's "connect to session" subscribe mode.
  Delivers "a remote agent co-designs your live model," the biggest lift here.

## Hosted preview images — DECIDED AGAINST (2026-08-31)

Gemini Spark can't display inline MCP `image` content (it renders text + fetchable
URLs only), so `wadi_preview`'s PNGs don't show there. Considered hosting each render
at a public R2 URL (`mcp.wadi.house/preview/<sha256>.png`) and returning the link.
**Declined:** Phase 2's live app view supersedes the need (the user watches the design
render in the Wadi app, so no agent-side image display is needed), and it would push
private design previews onto public URLs against the local-first posture. `wadi_preview`
stays inline-only — useful for image-capable clients (Claude Desktop, etc.) and as the
agent's own self-check; a Gemini user relies on `wadi_check` (text) for correctness and
the app for the picture.

## Open decisions

1. Host: Cloudflare Worker (2D) vs Node (3D) for v1. (Recommend Worker.)
2. Handoff: DECIDED — v1 uses copy-paste of the returned WDL into the app's WDL
   editor. The open-in-app link is deferred (worse for iteration, needs the decode
   bug fixed); reconsider only if a one-click first-open is wanted.
3. Domain: `mcp.wadi.house` (needs a DNS record + a Worker route).
4. Keep the reference/primer text single-sourced across `wadi_reference`,
   `window.wadi.help()`, and `docs/llms.txt` so they never drift.
5. Phase 2 transport for the app subscribe: WebSocket vs SSE (recommend WS via the
   Durable Object; SSE is a simpler fallback if WS proves fiddly).
6. Phase 2 session creation: app-minted id (recommended — the app owns save) vs
   agent-minted via `wadi_session_open`.

## Related

- Local stdio server + tools: `wadi-mcp/` (the code we reuse).
- In-page path: `window.wadi` + WebMCP (`wireWebMcpTools`), `docs/llms.txt`.
- Handoff/share: share-link + open-in-app (and its decode bug).
