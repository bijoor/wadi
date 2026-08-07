import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderGenerated } from "../../../scripts/gen-primitives.mjs";

// Guards the codegen-to-core loop: the committed generated schemas must equal a
// fresh render from the primitives' `fields`. If this fails, run `npm run
// gen-primitives`.
describe("gen-primitives — committed output is fresh", () => {
  it("objects.generated.ts === renderGenerated()", () => {
    const committed = readFileSync(new URL("./objects.generated.ts", import.meta.url), "utf8");
    expect(committed).toBe(renderGenerated());
  });
});
