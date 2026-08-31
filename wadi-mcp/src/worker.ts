// Cloudflare Worker that fronts the Wadi MCP container. It forwards every request
// (POST /mcp, GET /health) to the containerised Node server (dist/http.mjs). The
// server is STATELESS, so one shared container instance is enough; we pin a single
// instance by name. Scale later by routing on a header instead.

import { Container, getContainer } from "@cloudflare/containers";

export class WadiMcpContainer extends Container {
  // The port the containerised server listens on (matches http.ts PORT default).
  defaultPort = 8080;
  // Idle timeout — nothing to lose on sleep (stateless), so let it nap and scale to
  // zero between bursts.
  sleepAfter = "15m";
}

interface Env {
  WADI_MCP_CONTAINER: DurableObjectNamespace<WadiMcpContainer>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.WADI_MCP_CONTAINER, "singleton").fetch(request);
  },
};
