# Container image for the hosted Wadi MCP server (Cloudflare Containers).
# The whole pipeline (Langium compiler, editor/src, MCP SDK) is inlined into
# dist/http.mjs by esbuild; the ONLY runtime dependency is the native rasteriser
# (@resvg/resvg-js), installed here. Cloudflare Containers run linux/amd64.
# Node 22 LTS (not 20): the pipeline uses Object.groupBy, which needs Node 21+.
FROM --platform=linux/amd64 node:22-slim

WORKDIR /app

# Install just the native rasteriser (its prebuilt linux-x64-gnu binary).
RUN npm init -y >/dev/null 2>&1 && npm install @resvg/resvg-js@2.6.2 && npm cache clean --force

# The self-contained server bundle (built by `npm run build`).
COPY dist/http.mjs ./http.mjs

ENV PORT=8080
EXPOSE 8080
CMD ["node", "http.mjs"]
