// Share-link codec — pack a HouseConfig into a URL '#' fragment so a
// specific house can be handed to the static web app with NO backend.
//
// Why the fragment (`#…`) and not a query (`?…`): the fragment is never
// sent to a server, so this works on static hosting (GitHub Pages),
// isn't logged, and keeps the config client-side. The producer (the
// app's Share button) and the consumer (viewer boot) both live in the
// browser / WKWebView, so we can rely on the same Web APIs on each end.
//
// Wire format:  #w1=<base64url( gzip( utf8(JSON.stringify(config)) ) )>
//   - "w1" is a version tag so we can change the packing later without
//     misreading old links.
//   - gzip via the native CompressionStream. If it's unavailable we
//     store the bytes uncompressed; decode sniffs the gzip magic
//     (1f 8b) and only inflates when present, so both forms round-trip.

import type { HouseConfig } from "../schema/houseConfig";

const TAG = "w1";

// --- base64url (URL-safe, unpadded) over raw bytes ---
function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = "===".slice((s.length + 3) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const cs = new CompressionStream("gzip");
  const buf = await new Response(
    new Blob([new Uint8Array(bytes)]).stream().pipeThrough(cs),
  ).arrayBuffer();
  return new Uint8Array(buf);
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") return bytes;
  const ds = new DecompressionStream("gzip");
  const buf = await new Response(
    new Blob([new Uint8Array(bytes)]).stream().pipeThrough(ds),
  ).arrayBuffer();
  return new Uint8Array(buf);
}

/** Pack a config into the `w1=…` fragment payload (no leading '#'). */
export async function encodeConfigToHash(config: HouseConfig): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(config));
  const packed = await gzip(raw);
  return `${TAG}=${bytesToB64url(packed)}`;
}

/**
 * Decode a `#w1=…` fragment back into a raw parsed object (NOT yet
 * schema-validated — the caller runs `validate()` so the failure path is
 * uniform with every other load). Returns null when the fragment isn't a
 * share link or is corrupt, so the caller can fall back to normal load.
 */
export async function decodeConfigFromHash(
  hash: string,
): Promise<unknown | null> {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.startsWith(`${TAG}=`)) return null;
  try {
    let bytes = b64urlToBytes(h.slice(TAG.length + 1));
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      bytes = await gunzip(bytes);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// The canonical public home of the web app (custom domain on GitHub
// Pages). Used to anchor share links when we're NOT already running on a
// public web origin — i.e. inside the Tauri desktop app (origin is
// localhost/tauri asset) or a local dev server. A link must be openable by
// someone else, so it can never point at localhost.
const PUBLIC_APP_URL = "https://wadi.house/app/";

/**
 * Absolute shareable URL for a payload. On the deployed web app we anchor
 * at the current origin+path (so it stays correct if the site moves); in
 * the desktop app / local dev we fall back to the public URL so the link
 * actually works for the recipient.
 */
export function buildShareUrl(hashPayload: string): string {
  const isPublicWeb =
    location.protocol === "https:" &&
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1";
  const base = isPublicWeb
    ? `${location.origin}${location.pathname}`
    : PUBLIC_APP_URL;
  return `${base}#${hashPayload}`;
}
