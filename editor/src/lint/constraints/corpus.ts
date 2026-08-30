// KNOWN_GOOD — the real shipped houses. A constraint must never fire on these
// (the no-false-positive guard, the highest-value part of the driver).
//
// Test-support only: uses node fs and is imported solely by constraints.test.ts,
// so it never reaches the browser bundle. The set mirrors the parity harness.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as presolve } from "node:path";
import { resolveParametric } from "../../param/resolve";
import type { PartialHouse } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
// editor/src/lint/constraints → repo root
const repo = presolve(here, "..", "..", "..", "..");

// NOTE: the `editor/public/templates/*.wadi` catalog files are now zip BUNDLES
// (not JSON), so they can't be JSON.parsed here — the equivalent models live in
// `library/` as plain JSON and cover the same geometry.
const FILES = [
  "house_config.json",
  "library/coastal_konkan.wadi",
  "library/family_home.wadi",
  "library/single_story_cottage.wadi",
];

export const KNOWN_GOOD: { name: string; config: PartialHouse }[] = FILES.map((rel) => {
  const raw = JSON.parse(readFileSync(presolve(repo, rel), "utf8"));
  const resolved = resolveParametric(raw as never).config as unknown as PartialHouse;
  return { name: rel, config: resolved };
});
