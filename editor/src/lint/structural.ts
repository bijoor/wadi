// Structural conventions linter for Wadi houses — public entrypoint.
//
// The schema (Zod) + geometry pipeline catch configs that are ILL-FORMED. The
// conventions here catch configs that are well-formed but STRUCTURALLY UNSOUND —
// they compile and render, but the building would not stand up / floats in
// mid-air / is open to the weather.
//
// Each convention is a self-contained module under `constraints/` (its check +
// doc + example fixtures). This file is a thin loop over the registry; every
// consumer keeps calling `lintStructure` / `partitionFindings` / `CONVENTIONS`
// unchanged. See plans/functional-constraints-testing.md.

import type { HouseConfig } from "../schema/houseConfig";
import { allConstraints } from "./constraints";
import { buildContext } from "./constraints/context";

export type LintLevel = "error" | "warn";

export interface LintFinding {
  /** Convention id, e.g. "C1" — matches conventions.md. */
  rule: string;
  level: LintLevel;
  message: string;
  /** floor_number, when the finding is floor-scoped. */
  floor?: number;
  /** object name / id / type, when object-scoped. */
  where?: string;
}

/** Registry of the conventions this linter enforces (kept in sync with the doc). */
export interface ConventionMeta {
  id: string;
  title: string;
  level: LintLevel;
}
export const CONVENTIONS: ConventionMeta[] = allConstraints().map(({ id, title, level }) => ({
  id,
  title,
  level,
}));

/** Run every registered constraint over a resolved config. */
export function lintStructure(config: HouseConfig): LintFinding[] {
  const ctx = buildContext(config);
  return allConstraints().flatMap((c) => c.check(ctx));
}

/** Convenience: split findings by level. */
export function partitionFindings(findings: LintFinding[]): { errors: LintFinding[]; warnings: LintFinding[] } {
  return {
    errors: findings.filter((f) => f.level === "error"),
    warnings: findings.filter((f) => f.level === "warn"),
  };
}

/** Human one-line render of a finding (used by CLIs and the editor status). */
export function formatFinding(f: LintFinding): string {
  const icon = f.level === "error" ? "✖" : "⚠";
  return `${icon} [${f.rule}] ${f.message}`;
}
