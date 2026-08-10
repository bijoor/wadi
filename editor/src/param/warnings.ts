// Non-blocking channel for parametric-formula problems (cycles, unknown refs,
// bad expressions). Mirrors three/House3D.tsx::reportGeometryWarnings — kept
// OUT of the React render path: we stash on window and fire a CustomEvent that
// a banner can listen for (Phase 2). Headless/tests: no window, so it just
// no-ops (callers read the returned warnings array directly).

export interface FormulaWarning {
  // Human-locating tag, e.g. "variables/colB" or "floor0/obj3/x".
  where: string;
  formula: string;
  message: string;
  // "error" = the formula could not be resolved to a real value (unknown/unresolved
  // reference, circular reference, parse error, non-numeric). The model silently
  // falls back (to 0 or a prior value), so these are DEFECTS the author must fix —
  // the checkers (wadi_check, check.sh, the DSL-editor pill) fail on them. "warn"
  // is reserved for advisory-only formula problems (none today). Defaults to "error"
  // when omitted, so a producer that forgets is treated as the safe (failing) case.
  severity?: "error" | "warn";
}

/** True for a formula diagnostic that must fail a check (its default when unset). */
export function isFormulaError(w: FormulaWarning): boolean {
  return (w.severity ?? "error") === "error";
}

declare global {
  interface Window {
    __formulaWarnings?: FormulaWarning[];
  }
}

export function reportFormulaWarnings(warnings: FormulaWarning[]): void {
  if (typeof window === "undefined") return;
  window.__formulaWarnings = warnings;
  try {
    window.dispatchEvent(
      new CustomEvent("wadi-formula-warnings", { detail: warnings }),
    );
  } catch {
    /* CustomEvent unavailable — ignore */
  }
  if (warnings.length > 0) {
    // Surface during development without a banner yet.
    console.warn(
      `[parametric] ${warnings.length} formula warning(s):`,
      warnings.map((w) => `${w.where}: ${w.message} [${w.formula}]`),
    );
  }
}
