import { describe, it, expect } from "vitest";
import { joinRel, parentDir, thumbRelPath, patchThumbnails } from "../playground/thumbPaths.js";

describe("thumbPaths — cover-image path convention", () => {
  it("builds the subfolder-relative path", () => {
    expect(thumbRelPath("cottage", 1)).toBe("thumbnails/cottage-1.png");
    expect(thumbRelPath("cottage", 2)).toBe("thumbnails/cottage-2.png");
  });

  it("joins forward-slash + finds parent dir", () => {
    expect(joinRel("/a/b", "thumbnails/x.png")).toBe("/a/b/thumbnails/x.png");
    expect(joinRel("/a/b/", "thumbnails/x.png")).toBe("/a/b/thumbnails/x.png");
    expect(parentDir("/a/b/cottage.wdl")).toBe("/a/b");
    expect(parentDir("C:\\homes\\cottage.wdl")).toBe("C:\\homes");
  });
});

describe("patchThumbnails — inject the WDL reference", () => {
  const paths = ["thumbnails/h-1.png", "thumbnails/h-2.png"];
  const expected = 'thumbnails "thumbnails/h-1.png", "thumbnails/h-2.png"';

  it("replaces an existing thumbnails line, keeping indent", () => {
    const src = `house H {\n  template {\n    title "X"\n    thumbnails "old.png"\n  }\n}\n`;
    const out = patchThumbnails(src, paths);
    expect(out).toContain(`    ${expected}`);
    expect(out).not.toContain("old.png");
    expect(out).toContain('title "X"');
  });

  it("inserts into an existing template block", () => {
    const src = `house H {\n  template {\n    title "X"\n  }\n}\n`;
    const out = patchThumbnails(src, paths);
    expect(out).toContain(`    ${expected}`);
    expect(out).toContain('title "X"');
    // the new line lands inside the block (before the closing brace)
    expect(out.indexOf(expected)).toBeLessThan(out.indexOf("  }"));
  });

  it("creates a template block after the house header when none exists", () => {
    const src = `house H {\n  site { plot (300, 300) }\n}\n`;
    const out = patchThumbnails(src, paths);
    expect(out).toContain("template {");
    expect(out).toContain(`    ${expected}`);
    expect(out).toContain("site { plot (300, 300) }");
  });

  it("leaves source untouched when there is no house block", () => {
    const src = `// just a comment\n`;
    expect(patchThumbnails(src, paths)).toBe(src);
  });
});
