// Generic constraint driver — the "mechanism to add tests". Every constraint in
// the registry is exercised against its own fixtures (sensitivity + specificity)
// and the shared known-good corpus (no false positives), with no per-rule test
// code. Adding a rule's tests = filling its `fixtures`.

import { describe, it, expect } from "vitest";
import { allConstraints } from "./index";
import { buildContext } from "./context";
import { KNOWN_GOOD } from "./corpus";
import type { Constraint, PartialHouse } from "./types";
import type { LintFinding } from "../structural";

function runOne(c: Constraint, config: PartialHouse): LintFinding[] {
  return c.check(buildContext(config as never)).filter((f) => f.rule === c.id);
}

for (const c of allConstraints()) {
  describe(`${c.id} — ${c.title}`, () => {
    for (const f of c.fixtures.pass) {
      it(`passes: ${f.name}`, () => {
        expect(runOne(c, f.config)).toHaveLength(0);
      });
    }

    for (const f of c.fixtures.fail) {
      it(`flags: ${f.name}`, () => {
        const found = runOne(c, f.config);
        expect(found.length).toBeGreaterThanOrEqual(f.expect?.count ?? 1);
        if (f.expect?.level) expect(found[0].level).toBe(f.expect.level);
        if (f.expect?.messageIncludes) {
          expect(found.some((x) => x.message.includes(f.expect!.messageIncludes!))).toBe(true);
        }
      });
    }

    // Shipped houses are structurally SOUND, so a constraint must never raise an
    // ERROR on them (errors fail check.sh). Advisory WARNINGS legitimately occur —
    // an intentional verandah (C2) or a deliberate floor-height gap (C4) — and are
    // allowed; a rule's warning specificity is covered by its `pass` fixtures.
    it("raises no error on any known-good house", () => {
      for (const h of KNOWN_GOOD) {
        const errors = runOne(c, h.config).filter((f) => f.level === "error");
        expect(errors, h.name).toHaveLength(0);
      }
    });
  });
}
