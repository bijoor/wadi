// Local dev co-editing server for TESTING the remote co-edit flow WITHOUT deploying
// the Cloudflare worker. One Node process serves both:
//   - the MCP endpoint at POST /mcp  (the SAME createWadiMcpServer as the hosted
//     container, so wadi_session_get/set/add_module/list_modules behave identically)
//   - an in-memory session RELAY at /session/<code>  (GET/POST + WebSocket) that
//     carries the WDL AND the custom component modules, mirroring the SessionRelay
//     Durable Object's wire protocol in worker.ts.
//
// Run from wadi-mcp/:  npm run local   (regenerates the parser + assets first)
// Then in the app open  http://localhost:5199/viewer.html?mcp=http://localhost:8787
// and start a co-edit session; point your agent's MCP client at http://localhost:8787/mcp.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebSocketServer, type WebSocket } from "ws";
import { createWadiMcpServer } from "./mcpTools";

const PORT = Number(process.env.PORT ?? 8787);
const SELF = process.env.SELF ?? `http://localhost:${PORT}`;

interface Session {
  wdl: string;
  modules: Record<string, string>;
  sockets: Set<WebSocket>;
}
const sessions = new Map<string, Session>();
function sess(code: string): Session {
  let s = sessions.get(code);
  if (!s) {
    s = { wdl: "", modules: {}, sockets: new Set() };
    sessions.set(code, s);
  }
  return s;
}
function broadcast(s: Session, msg: unknown, from: WebSocket | null): void {
  const str = JSON.stringify(msg);
  for (const sock of s.sockets) {
    if (sock === from) continue;
    try { sock.send(str); } catch { s.sockets.delete(sock); }
  }
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, mcp-session-id, mcp-protocol-version, authorization, last-event-id",
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
}
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  setCors(res);
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.method === "GET" && (url === "/health" || url === "/")) {
    res.writeHead(200, { "content-type": "text/plain" }).end("wadi-mcp local co-edit ok");
    return;
  }

  // ---- Session relay (HTTP): GET reads state, POST applies wdl / module changes ----
  const rel = /^\/session\/([^/]+)$/.exec(url);
  if (rel) {
    const s = sess(decodeURIComponent(rel[1]));
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ wdl: s.wdl, modules: s.modules, clients: s.sockets.size }));
      return;
    }
    if (req.method === "POST") {
      const body = (await readJson(req).catch(() => ({}))) as {
        wdl?: string; modules?: Record<string, string>;
        setModule?: { ref?: string; wdl?: string }; removeModule?: string;
      };
      if (typeof body.wdl === "string") { s.wdl = body.wdl; broadcast(s, { type: "wdl", wdl: s.wdl }, null); }
      if (body.modules && typeof body.modules === "object") { s.modules = body.modules; broadcast(s, { type: "modules", modules: s.modules }, null); }
      if (body.setModule?.ref) { s.modules = { ...s.modules, [body.setModule.ref]: String(body.setModule.wdl ?? "") }; broadcast(s, { type: "modules", modules: s.modules }, null); }
      if (body.removeModule) { const m = { ...s.modules }; delete m[body.removeModule]; s.modules = m; broadcast(s, { type: "modules", modules: s.modules }, null); }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, clients: s.sockets.size }));
      return;
    }
    res.writeHead(405).end("method not allowed");
    return;
  }

  // ---- MCP endpoint (same server factory as the hosted container) ----
  if (url === "/mcp" || url === "/mcp/") {
    const server = createWadiMcpServer({ appBridge: false, fsPaths: false, sessionBaseUrl: SELF });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    const ACCEPT = "application/json, text/event-stream";
    req.headers.accept = ACCEPT;
    if (Array.isArray(req.rawHeaders)) {
      let found = false;
      for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() === "accept") { req.rawHeaders[i + 1] = ACCEPT; found = true; }
      }
      if (!found) req.rawHeaders.push("Accept", ACCEPT);
    }
    try {
      await server.connect(transport);
      const body = req.method === "POST" ? await readJson(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" })
          .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: (e as Error).message }, id: null }));
      }
    }
    return;
  }

  res.writeHead(404).end("not found");
});

// ---- Session relay (WebSocket): the app subscribes here ----
const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (req, socket, head) => {
  const url = (req.url ?? "").split("?")[0];
  const m = /^\/session\/([^/]+)\/ws$/.exec(url);
  if (!m) { socket.destroy(); return; }
  const s = sess(decodeURIComponent(m[1]));
  wss.handleUpgrade(req, socket, head, (ws) => {
    s.sockets.add(ws);
    ws.send(JSON.stringify(s.wdl ? { type: "wdl", wdl: s.wdl } : { type: "hello" }));
    if (Object.keys(s.modules).length) ws.send(JSON.stringify({ type: "modules", modules: s.modules }));
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data)) as { type?: string; wdl?: string; modules?: Record<string, string> };
        if (msg?.type === "wdl" && typeof msg.wdl === "string") { s.wdl = msg.wdl; broadcast(s, { type: "wdl", wdl: s.wdl }, ws); }
        else if (msg?.type === "modules" && msg.modules && typeof msg.modules === "object") { s.modules = msg.modules; broadcast(s, { type: "modules", modules: s.modules }, ws); }
      } catch { /* ignore malformed frames */ }
    });
    ws.on("close", () => s.sockets.delete(ws));
    ws.on("error", () => s.sockets.delete(ws));
  });
});

httpServer.listen(PORT, () => {
  console.error(`[wadi-mcp local co-edit] http://localhost:${PORT}`);
  console.error(`  MCP:   POST http://localhost:${PORT}/mcp`);
  console.error(`  Relay: /session/<code>  (GET/POST + WebSocket /ws)`);
  console.error(`  App:   http://localhost:5199/viewer.html?mcp=http://localhost:${PORT}`);
});
