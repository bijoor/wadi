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
  addBundleThumbnail,
  thumbnailUrl,
  pruneBundleThumbnails,
  readBundleManifest,
  readBundleCoverUrls,
} from "./wadiBundle";
import { wdlToConfig } from "./wdl";

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

  it("parses a plain .wdl SOURCE file (by extension) into a compiled model + wdl", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const wdl = emitWdl(legacy.config as unknown as Record<string, unknown>);
    const wdlBytes = new TextEncoder().encode(wdl);

    expect(isWadiBundle(wdlBytes)).toBe(false); // not a zip
    const loaded = await parseWadiBytes(wdlBytes, "house.wdl", "/tmp/house.wdl");
    expect(loaded.wdl).toBe(wdl); // the source text, verbatim
    expect(loaded.filePath).toBe("/tmp/house.wdl"); // so the live watcher can attach
    expect(loaded.config.floors.length).toBe(legacy.config.floors.length);
  });

  it("detects a .wdl by content when the filename has no known extension", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const wdl = emitWdl(legacy.config as unknown as Record<string, unknown>);
    // Leading whitespace + a comment: first non-space char is not '{', so it is WDL.
    const wdlBytes = new TextEncoder().encode("\n  // a house\n" + wdl);
    const loaded = await parseWadiBytes(wdlBytes, "dropped");
    expect(loaded.wdl).toContain("floor");
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

  it("capture: a data URL becomes a bundle file, referenced by path", () => {
    setBundleThumbnails({});
    const dataUrl = "data:image/png;base64,AAECAwQF"; // 6 bytes
    const path = addBundleThumbnail(dataUrl);
    expect(path).toMatch(/^thumbnails\/shot-\d+\.png$/);
    expect(Object.keys(currentBundleThumbnails())).toContain(path);
    // Display resolves the path back to a URL; a data: URL passes through.
    expect(thumbnailUrl(path)).toBe(dataUrl);
    expect(thumbnailUrl("data:image/png;base64,ZZZZ")).toBe("data:image/png;base64,ZZZZ");
    // Pruning drops files no longer referenced.
    pruneBundleThumbnails([]);
    expect(Object.keys(currentBundleThumbnails())).not.toContain(path);
  });

  it("template.thumbnails PATHS round-trip through the WDL", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const cfg = {
      ...legacy.config,
      template: { ...(legacy.config as { template?: object }).template, thumbnails: ["thumbnails/cover.png", "thumbnails/iso.png"] },
    };
    const wdl = emitWdl(cfg as unknown as Record<string, unknown>);
    expect(wdl).toContain('thumbnails "thumbnails/cover.png", "thumbnails/iso.png"');

    const back = await wdlToConfig(wdl);
    expect(back.ok).toBe(true);
    expect((back.config as { template?: { thumbnails?: string[] } }).template?.thumbnails).toEqual([
      "thumbnails/cover.png",
      "thumbnails/iso.png",
    ]);
  });

  it("embeds catalog meta + cover in the manifest for fast indexing", async () => {
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const wdl = emitWdl(legacy.config as unknown as Record<string, unknown>);
    const cover = new Uint8Array([0xff, 0xd8, 0xff, 9, 8, 7]);
    const bytes = await buildWadiBundle(
      wdl,
      { "thumbnails/cover.jpg": cover },
      { meta: { title: "Coastal", bedrooms: 2, floors: 1 }, cover: "thumbnails/cover.jpg" },
    );

    const man = await readBundleManifest(bytes);
    expect(man?.format).toBe("wadi-bundle");
    expect((man?.meta as { title?: string })?.title).toBe("Coastal");
    expect(man?.cover).toBe("thumbnails/cover.jpg");

    const covers = await readBundleCoverUrls(bytes);
    expect(covers.length).toBe(1);
    expect(covers[0]).toMatch(/^data:image\/jpeg;base64,/);

    // Not-a-bundle inputs return empty, not throw.
    expect(await readBundleManifest(jsonBytes)).toBeNull();
    expect(await readBundleCoverUrls(jsonBytes)).toEqual([]);
  });

  it("migrates a legacy JSON's inline thumbnails into template.thumbnails + files", async () => {
    setBundleThumbnails({});
    // A legacy config: base64 in top-level `thumbnails`, no template paths.
    const legacy = await parseWadiBytes(jsonBytes, "coastal.wadi");
    const cfg = {
      ...legacy.config,
      thumbnails: ["data:image/png;base64,AAECAwQF", "data:image/jpeg;base64,/9j/AAA="],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(cfg));

    const loaded = await parseWadiBytes(bytes, "old-template.wadi");
    const tpl = (loaded.config as { template?: { thumbnails?: string[] } }).template;
    // Base64 thumbnails moved to template PATHS, and the inline array is gone.
    expect(tpl?.thumbnails?.length).toBe(2);
    expect(tpl?.thumbnails?.every((p) => p.startsWith("thumbnails/"))).toBe(true);
    expect((loaded.config as { thumbnails?: unknown }).thumbnails).toBeUndefined();
    // The decoded files are in the bundle, so a save carries them.
    for (const p of tpl!.thumbnails!) expect(Object.keys(currentBundleThumbnails())).toContain(p);
    // And they now round-trip through the WDL (the whole point).
    const wdl = emitWdl(loaded.config as unknown as Record<string, unknown>);
    expect(wdl).toMatch(/thumbnails "thumbnails\/shot-\d+\.\w+"/);
  });

  it("rejects a bundle with no model.wdl", async () => {
    // A zip that has only a manifest, no model.wdl.
    const { zipSync, strToU8 } = await import("fflate");
    const bad = zipSync({ "wadi.json": strToU8("{}") });
    await expect(parseWadiBytes(bad, "bad.wadi")).rejects.toThrow(/model\.wdl/);
  });
});
