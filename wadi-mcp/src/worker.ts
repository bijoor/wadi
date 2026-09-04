// Cloudflare Worker fronting the Wadi MCP server. Two jobs:
//   1. Forward MCP requests (POST /mcp, GET /health) to the containerised Node
//      server (dist/http.mjs).
//   2. Run the Phase-2 LIVE CO-EDITING relay: /session/<code> is a SessionRelay
//      Durable Object holding the current WDL for a session, fanning updates out to
//      the Wadi app over WebSocket while the agent pushes edits via the MCP tools.
//      See plans/remote-mcp-server.md (Phase 2). A relay, not a store: ephemeral,
//      session-code gated, and the app owns the actual Save.

import { Container, getContainer } from "@cloudflare/containers";

export class WadiMcpContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "15m";
}

// One instance per session code. Holds the current WDL and broadcasts every change
// to the connected app client(s) over WebSocket. Whole-document last-write-wins.
// Session wire protocol (shared with the local dev relay and the app):
//   app  -> relay (WS):   { type:"wdl", wdl } | { type:"modules", modules }
//   tool -> relay (POST):  { wdl } | { modules } | { setModule:{ref,wdl} } | { removeModule:ref }
//   relay -> app (WS):     { type:"wdl", wdl } | { type:"modules", modules }
//   relay GET:             { wdl, modules, clients }
export class SessionRelay {
  private state: DurableObjectState;
  private wdl = "";
  private modules: Record<string, string> = {};
  private sockets = new Set<WebSocket>();

  constructor(state: DurableObjectState) {
    this.state = state;
    void this.state.blockConcurrencyWhile(async () => {
      this.wdl = (await this.state.storage.get<string>("wdl")) ?? "";
      this.modules = (await this.state.storage.get<Record<string, string>>("modules")) ?? {};
    });
  }

  async fetch(request: Request): Promise<Response> {
    // App subscribes over WebSocket: receives the current WDL + modules immediately,
    // then every update; may also push its own edits back.
    if (request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      this.sockets.add(server);
      server.send(JSON.stringify(this.wdl ? { type: "wdl", wdl: this.wdl } : { type: "hello" }));
      if (Object.keys(this.modules).length) server.send(JSON.stringify({ type: "modules", modules: this.modules }));
      server.addEventListener("message", (evt) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : "";
          const msg = JSON.parse(raw) as { type?: string; wdl?: string; modules?: Record<string, string> };
          if (msg?.type === "wdl" && typeof msg.wdl === "string") this.setWdl(msg.wdl, server);
          else if (msg?.type === "modules" && msg.modules && typeof msg.modules === "object") this.setModules(msg.modules, server);
        } catch {
          /* ignore malformed frames */
        }
      });
      const drop = (): void => void this.sockets.delete(server);
      server.addEventListener("close", drop);
      server.addEventListener("error", drop);
      return new Response(null, { status: 101, webSocket: client });
    }

    // The MCP tools push/read the WDL + modules over plain HTTP.
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        wdl?: string;
        modules?: Record<string, string>;
        setModule?: { ref?: string; wdl?: string };
        removeModule?: string;
      };
      if (typeof body.wdl === "string") this.setWdl(body.wdl, null);
      if (body.modules && typeof body.modules === "object") this.setModules(body.modules, null);
      if (body.setModule?.ref) this.setModules({ ...this.modules, [body.setModule.ref]: String(body.setModule.wdl ?? "") }, null);
      if (body.removeModule) { const m = { ...this.modules }; delete m[body.removeModule]; this.setModules(m, null); }
      return Response.json({ ok: true, clients: this.sockets.size });
    }
    if (request.method === "GET") {
      return Response.json({ wdl: this.wdl, modules: this.modules, clients: this.sockets.size });
    }
    return new Response("method not allowed", { status: 405 });
  }

  private broadcast(msg: unknown, from: WebSocket | null): void {
    const s = JSON.stringify(msg);
    for (const sock of this.sockets) {
      if (sock === from) continue;
      try { sock.send(s); } catch { this.sockets.delete(sock); }
    }
    // Idle cleanup: forget the session 6h after the last change if nobody's connected.
    void this.state.storage.setAlarm(Date.now() + 6 * 3600 * 1000);
  }

  private setWdl(wdl: string, from: WebSocket | null): void {
    this.wdl = wdl;
    void this.state.storage.put("wdl", wdl);
    this.broadcast({ type: "wdl", wdl }, from);
  }

  private setModules(modules: Record<string, string>, from: WebSocket | null): void {
    this.modules = modules;
    void this.state.storage.put("modules", modules);
    this.broadcast({ type: "modules", modules }, from);
  }

  async alarm(): Promise<void> {
    if (this.sockets.size === 0) {
      this.wdl = "";
      this.modules = {};
      await this.state.storage.deleteAll();
    }
  }
}

interface Env {
  WADI_MCP_CONTAINER: DurableObjectNamespace<WadiMcpContainer>;
  SESSION_RELAY: DurableObjectNamespace<SessionRelay>;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/session\/([A-Za-z0-9_-]{4,64})(?:\/ws)?$/);
    if (m) {
      if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
      const stub = env.SESSION_RELAY.get(env.SESSION_RELAY.idFromName(m[1]));
      const resp = await stub.fetch(request);
      if (resp.status === 101) return resp; // WebSocket upgrade — pass through
      const h = new Headers(resp.headers);
      for (const [k, v] of Object.entries(CORS)) h.set(k, v);
      return new Response(resp.body, { status: resp.status, headers: h });
    }
    // Everything else → the MCP container (stateless server is one shared instance).
    return getContainer(env.WADI_MCP_CONTAINER, "singleton").fetch(request);
  },
};
