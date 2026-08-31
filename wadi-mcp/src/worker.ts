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
export class SessionRelay {
  private state: DurableObjectState;
  private wdl = "";
  private sockets = new Set<WebSocket>();

  constructor(state: DurableObjectState) {
    this.state = state;
    void this.state.blockConcurrencyWhile(async () => {
      this.wdl = (await this.state.storage.get<string>("wdl")) ?? "";
    });
  }

  async fetch(request: Request): Promise<Response> {
    // App subscribes over WebSocket: receives the current WDL immediately, then
    // every update; may also push its own edits back.
    if (request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      this.sockets.add(server);
      server.send(JSON.stringify(this.wdl ? { type: "wdl", wdl: this.wdl } : { type: "hello" }));
      server.addEventListener("message", (evt) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : "";
          const msg = JSON.parse(raw) as { type?: string; wdl?: string };
          if (msg?.type === "wdl" && typeof msg.wdl === "string") this.set(msg.wdl, server);
        } catch {
          /* ignore malformed frames */
        }
      });
      const drop = (): void => void this.sockets.delete(server);
      server.addEventListener("close", drop);
      server.addEventListener("error", drop);
      return new Response(null, { status: 101, webSocket: client });
    }

    // The MCP tools push/read the WDL over plain HTTP.
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { wdl?: string };
      this.set(String(body.wdl ?? ""), null);
      return Response.json({ ok: true, clients: this.sockets.size });
    }
    if (request.method === "GET") {
      return Response.json({ wdl: this.wdl, clients: this.sockets.size });
    }
    return new Response("method not allowed", { status: 405 });
  }

  private set(wdl: string, from: WebSocket | null): void {
    this.wdl = wdl;
    void this.state.storage.put("wdl", wdl);
    const msg = JSON.stringify({ type: "wdl", wdl });
    for (const s of this.sockets) {
      if (s === from) continue;
      try {
        s.send(msg);
      } catch {
        this.sockets.delete(s);
      }
    }
    // Idle cleanup: forget the WDL 6h after the last change if nobody's connected.
    void this.state.storage.setAlarm(Date.now() + 6 * 3600 * 1000);
  }

  async alarm(): Promise<void> {
    if (this.sockets.size === 0) {
      this.wdl = "";
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
