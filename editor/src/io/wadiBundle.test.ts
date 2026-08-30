// Round-trip coverage for the `.wadi` BUNDLE format (wadiBundle.ts):
//   - a legacy JSON `.wadi` still loads (magic-byte fallback)
//   - a bundle carries the WDL source verbatim and re-compiles to the same model
//   - thumbnail files survive a load → save round-trip
//
// The fixture is a real library model; we decompile it to WDL, bundle it, then
// parse the bundle back. The WDL compiler resolves via the vite.config alias
// (Vitest reuses that config), same as the app.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { emitWdl } from "wadi-wdl-emitter";
import {
  buildWadiBundle,
  parseWadiBytes,
  isWadiBundle,
  currentBundleThumbnails,
  setBundleThumbnails,
} from "./wadiBundle";

// Vitest runs with cwd = editor/, so the repo's library/ is one level up.
const FIXTURE = path.resolve(process.cwd(), "..", "library", "coastal_konkan.wadi");
const jsonBytes = new Uint8Array(readFileSync(FIXTURE));

describe("wadi bundle", () => {
  it("detects a zip bundle by magic bytes, and legacy JSON is not one", () => {
    expect(isWadiBundle(jsonBytes)).toBe(false);
    expect(isWadiBundle(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });

  it("loads a legacy JSON .wadi with no WDL (store decompiles)", async () => {
    const loaded = await parseWadiBytes(jsonBytes, "coastal.wadi");
    expect(loaded.config).toBeTruthy();
    expect(loaded.config.floors.length).toBeGreaterThan(0);
    expect(loaded.wdl).toBeUndefined();
  });

  it("round-trips a bundle: WDL source is preserved verbatim and re-compiles", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const wdl = emitWdl(legacy.config as unknown as Record<string, unknown>);
    expect(wdl).toContain("floor"); // sanity: real WDL text

    const bytes = await buildWadiBundle(wdl);
    expect(isWadiBundle(bytes)).toBe(true);

    const loaded = await parseWadiBytes(bytes, "coastal.wadi", null);
    expect(loaded.wdl).toBe(wdl); // author's exact source, not re-decompiled
    expect(loaded.config.floors.length).toBe(legacy.config.floors.length);
  });

  it("preserves thumbnail files across a load → save round-trip", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const wdl = emitWdl(legacy.config as unknown as Record<string, unknown>);
    const cover = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 1, 2, 3, 4]); // fake JPEG bytes

    const bytes = await buildWadiBundle(wdl, { "thumbnails/cover.jpg": cover });
    setBundleThumbnails({}); // clear, so we prove the load repopulates it

    await parseWadiBytes(bytes, "coastal.wadi");
    const carried = currentBundleThumbnails();
    expect(Object.keys(carried)).toContain("thumbnails/cover.jpg");
    expect(Array.from(carried["thumbnails/cover.jpg"])).toEqual(Array.from(cover));
  });

  it("rejects a bundle with no model.wdl", async () => {
    // A zip that has only a manifest, no model.wdl.
    const { zipSync, strToU8 } = await import("fflate");
    const bad = zipSync({ "wadi.json": strToU8("{}") });
    await expect(parseWadiBytes(bad, "bad.wadi")).rejects.toThrow(/model\.wdl/);
  });
});
