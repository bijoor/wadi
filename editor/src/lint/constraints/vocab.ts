// Constraint vocabulary — the small, EMERGENT (b) helper set.
//
// This is the "matcher library" a constraint's check() is written against:
// a finding builder plus the recurring model-navigation / formatting helpers.
// It grows as rules migrate; do not pre-build helpers no rule uses yet.

import type { LintFinding, LintLevel } from "../structural";

export type Bag = Record<string, unknown>;

// ---- formatting (kept byte-identical to the legacy linter's helpers) -------

export function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function floorLabel(fl: Bag): string {
  const nm = typeof fl.name === "string" && fl.name ? ` "${fl.name}"` : "";
  return `floor ${num(fl.floor_number)}${nm}`;
}
export function objLabel(o: Bag): string {
  if (typeof o.name === "string" && o.name) return `"${o.name}"`;
  if (typeof o.id === "string" && o.id) return `"${o.id}"`;
  return String(o.type);
}
/** Objects on a floor that are switched on (matches the legacy `enabled !== false`). */
export function activeObjects(fl: Bag): Bag[] {
  return ((fl.objects as Bag[] | undefined) ?? []).filter((o) => o.enabled !== false);
}

// ---- finding builder -------------------------------------------------------

export interface Reporter {
  findings: LintFinding[];
  /** Record a finding for this rule (level defaults to the rule's default). */
  report(message: string, opts?: { where?: string; floor?: number; level?: LintLevel }): void;
}

/** A finding collector bound to a rule id + default level. */
export function makeReport(rule: string, defaultLevel: LintLevel): Reporter {
  const findings: LintFinding[] = [];
  return {
    findings,
    report(message, opts) {
      findings.push({
        rule,
        level: opts?.level ?? defaultLevel,
        message,
        ...(opts?.floor !== undefined ? { floor: opts.floor } : {}),
        ...(opts?.where !== undefined ? { where: opts.where } : {}),
      });
    },
  };
}
