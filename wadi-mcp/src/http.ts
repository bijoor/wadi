// Wadi MCP server — HTTP entry for the HOSTED/online server (Cloudflare Container).
// Speaks the MCP Streamable HTTP transport at POST /mcp, STATELESS: a fresh server
// + transport per request, so any remote MCP client (Gemini "Add a custom app",
// Claude.ai connectors, ChatGPT) can author/check/preview Wadi `.wdl` by URL, with
// no local install.
//
// It reuses the SAME createWadiMcpServer factory as the stdio bin, with the
// local-only tools OFF: `appBridge:false` (view_3d/capture_3d reach a LOCAL app,
// which a hosted server can't) and `fsPaths:false` (a remote caller can't read the
// container's disk — previews come back as inline images only).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createWadiMcpServer } from "./mcpTools";

const PORT = Number(process.env.PORT ?? 8080);
const MCP_PATH = "/mcp";

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
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  setCors(res);
  const url = (req.url ?? "").split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "GET" && (url === "/health" || url === "/")) {
    res.writeHead(200, { "content-type": "text/plain" }).end("wadi-mcp ok");
    return;
  }

  if (url === MCP_PATH) {
    // Stateless: one server + transport per request. enableJsonResponse returns a
    // plain application/json reply (no SSE stream), which suits request/response
    // tools and simple remote clients.
    const server = createWadiMcpServer({ appBridge: false, fsPaths: false });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      const body = req.method === "POST" ? await readJson(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: (e as Error).message },
            id: null,
          }),
        );
      }
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" }).end("not found");
});

httpServer.listen(PORT, () => {
  console.error(`[wadi-mcp] HTTP (Streamable HTTP MCP) on :${PORT}${MCP_PATH}`);
});
