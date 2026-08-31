// Wadi MCP server — stdio entry (the npm bin). Boots the shared tool server on
// StdioServerTransport for LOCAL coding agents (Claude Code, Antigravity, Claude
// Desktop). The app-bridge tools (view_3d / capture_3d) and filesystem preview
// paths are enabled here because the agent runs on the user's own machine.
//
// stdout is the MCP protocol channel — never write to it. Logs go to stderr.
//
// The hosted/online variant is src/http.ts (Streamable HTTP), which reuses the
// SAME createWadiMcpServer factory with the local-only tools disabled.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWadiMcpServer } from "./mcpTools";

const server = createWadiMcpServer({ appBridge: true, fsPaths: true });
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  "[wadi-mcp] ready (stdio) — tools: wadi_check, wadi_scope, wadi_preview, wadi_examples, " +
    "wadi_reference, wadi_modules, wadi_module, wadi_view_3d, wadi_capture_3d, wadi_glb_inspect",
);
