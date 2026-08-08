import { describe, it, expect } from "vitest";
import { openingStartOffset, resolveOpeningAnchors } from "./openingAnchor";

describe("openingStartOffset", () => {
  const L = 200;
  const w = 40;

  it("start (default) is identity", () => {
    expect(openingStartOffset("start", 30, w, L)).toBe(30);
    expect(openingStartOffset(undefined, 30, w, L)).toBe(30);
  });

  it("end measures the far edge from the wall end", () => {
    // offset 0 => flush to the end => span [160, 200]
    expect(openingStartOffset("end", 0, w, L)).toBe(160);
    // offset 30 => 30 from the end => span [130, 170]
    expect(openingStartOffset("end", 30, w, L)).toBe(130);
  });

  it("center places the opening centre at the wall midpoint + shift", () => {
    // 0 shift => centred => start = (200-40)/2 = 80
    expect(openingStartOffset("center", 0, w, L)).toBe(80);
    // +20 shift toward the end
    expect(openingStartOffset("center", 20, w, L)).toBe(100);
    // negative shift toward the start
    expect(openingStartOffset("center", -20, w, L)).toBe(60);
  });

  it("anchors are stable as the wall grows", () => {
    // end-anchored opening keeps its distance from the (moving) end
    expect(openingStartOffset("end", 30, w, 200)).toBe(130);
    expect(openingStartOffset("end", 30, w, 300)).toBe(230); // still 40 wide, 30 from end
  });
});

describe("resolveOpeningAnchors", () => {
  it("rewrites offset to start-based and strips anchor", () => {
    const out = resolveOpeningAnchors(
      [{ kind: "door", offset: 0, width: 40, anchor: "end" }],
      200,
    );
    expect(out[0]).toEqual({ kind: "door", offset: 160, width: 40 });
    expect("anchor" in out[0]).toBe(false);
  });

  it("leaves start/anchorless openings byte-identical (drops redundant anchor:start)", () => {
    const plain = { kind: "window", offset: 25, width: 30 };
    expect(resolveOpeningAnchors([plain], 200)[0]).toBe(plain); // same reference
    expect(resolveOpeningAnchors([{ ...plain, anchor: "start" }], 200)[0]).toEqual(plain);
  });
});
