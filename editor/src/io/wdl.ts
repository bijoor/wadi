// Lazy bridge to the WDL (.wdl) compiler + decompiler. The Langium-based engine is
// heavy, so it is loaded through DYNAMIC import(): Vite code-splits it into its own
// chunk that only downloads when an agent (or a future always-on WDL editor)
// actually authors WDL — the everyday viewer load never pulls it in. This reuses
// the exact compiler source the separate /dsl editor uses, no second copy.

import { validate, type HouseConfig } from "../schema/houseConfig";

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
    raw = compileDsl(text);
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

// Decompile a HouseConfig back to .wdl text (so an agent can read + modify the
// current model as WDL). Lazily imports the emitter chunk.
export async function configToWdl(config: HouseConfig): Promise<string> {
  const { emitWdl } = await import("wadi-wdl-emitter");
  return emitWdl(config as unknown as Record<string, unknown>);
}
