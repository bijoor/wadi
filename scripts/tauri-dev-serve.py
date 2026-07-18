#!/usr/bin/env python3
"""Static server for docs/, tuned for Tauri dev mode.

Python's stdlib http.server caches aggressively via ETag/Last-Modified,
and WKWebView's shared NSURLCache holds onto index.html even across
hard reloads. That means a fresh `vite build` produces a new
viewer-<hash>.js, docs/index.html gets rewritten to reference it, but
the Tauri window still shows the previous bundle until the OS cache
clears.

This server disables all caching (Cache-Control: no-store) so every
GET returns the current on-disk contents. Cheap for local dev; do NOT
use as a production server.

Usage:  python3 tauri-dev-serve.py [PORT]  (default 1420)
"""

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 1420
    docs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
    os.chdir(docs_dir)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"Serving docs/ at http://127.0.0.1:{port} (no-cache)")
    server.serve_forever()


if __name__ == "__main__":
    main()
