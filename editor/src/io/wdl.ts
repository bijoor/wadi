// Lazy bridge to the WDL (.wdl) compiler + decompiler. The Langium-based engine is
// heavy, so it is loaded through DYNAMIC import(): Vite code-splits it into its own
// chunk that only downloads when an agent (or a future always-on WDL editor)
// actually authors WDL — the everyday viewer load never pulls it in. This reuses
// the exact compiler source the separate /dsl editor uses, no second copy.

import { validate, type HouseConfig } from "../schema/houseConfig";
// STATIC import: the decompiler is Langium-free (config -> text walk), so it costs
// almost nothing and can run on every model change. It stays out of the lazy
// compiler chunk. Only compiling WDL -> model (below) needs the heavy Langium path.
import { emitWdl } from "wadi-wdl-emitter";

// SYNC decompile: the current model -> its .wdl text. Cheap enough that the store
// keeps it ALWAYS in sync, so the model natively carries its WDL. Guarded: a
// malformed config yields "" rather than throwing (never breaks a store update).
export function configToWdlText(config: HouseConfig | null | undefined): string {
  if (!config) return "";
  try {
    return emitWdl(config as unknown as Record<string, unknown>);
  } catch {
    return "";
  }
}

export interface WdlCompileResult {
  ok: boolean;
  /** The validated HouseConfig, when ok. */
  config?: HouseConfig;
  /** Compile (lex/parse/link) or schema-validation errors, human-readable. */
  errors: string[];
}

// Compile .wdl text → a validated HouseConfig. Never throws — parse/link failures
// and schema failures come back as `{ ok:false, errors }` so callers (WebMCP tools)
// can hand the agent something to fix.
export async function wdlToConfig(text: string): Promise<WdlCompileResult> {
  let raw: Record<string, unknown>;
  try {
    // Bare specifier (typed via editor/src/types/wadi-wdl.d.ts, aliased to the
    // real wadi-dsl source in vite.config). This keeps editor's tsc from
    // deep-checking wadi-dsl's internals — they version independently — while
    // Vite/esbuild bundles the real compiler into a lazy chunk.
    const { compileDsl } = await import("wadi-wdl-compiler");
    const { stdResolveModule } = await import("./stdModules");
    raw = compileDsl(text, { resolveModule: stdResolveModule });
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  const parsed = validate(raw);
  if (!parsed.ok || !parsed.data) {
    return {
      ok: false,
      errors: (parsed.errors ?? []).map((er) => `/${er.path}: ${er.message}`),
    };
  }
  return { ok: true, config: parsed.data, errors: [] };
}

