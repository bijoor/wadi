// Typed boundary for the WDL compiler/decompiler that lives in the sibling
// wadi-dsl package. We declare only the surface the viewer uses, so editor's tsc
// does NOT deep-check wadi-dsl's internals (they version independently, under a
// looser config). Vite aliases these bare specifiers to the real wadi-dsl source
// (see vite.config.ts / vite.viewer.config.ts), so the actual compiler is bundled
// — as a lazy chunk, since it's only reached through dynamic import().

declare module "wadi-wdl-compiler" {
  /** Parse + link + generate: .wdl text -> a HouseConfig-shaped object. Throws on
   *  lex/parse/link errors (message carries the details). */
  export function compileDsl(text: string, opts?: unknown): Record<string, unknown>;
}

declare module "wadi-wdl-emitter" {
  export interface EmitWdlOptions {
    /** Per-primitive decompile hook (the registry `emitWdl` capability). Returns a
     *  contributed primitive's bespoke `.wdl` block, or undefined for the generic
     *  form. Omitted by headless callers. */
    emitObject?: (obj: Record<string, unknown>) => string | null | undefined;
  }
  /** Decompile a HouseConfig back to editable .wdl text. */
  export function emitWdl(
    config: Record<string, unknown>,
    houseName?: string,
    opts?: EmitWdlOptions,
  ): string;
}

// The Monaco WDL language, reused from the DSL playground (highlighting + the
// in-process Langium LSP adapters). Only the lazy wdlMonaco chunk imports these,
// so editor's tsc doesn't deep-check wadi-dsl/playground.
declare module "wadi-wdl-monaco-lang" {
  export const LANG_ID: string;
  /** Register the WDL Monarch tokenizer + language config on a Monaco namespace. */
  export function registerWadiDsl(monaco: unknown): void;
}

declare module "wadi-wdl-monaco-lsp" {
  export interface LspHooks {
    resolveModule: (name: string) => string | undefined;
    version: () => number;
    languageId: string;
  }
  /** Wire completion / hover / go-to-def / find-refs / rename (in-process Langium
   *  LSP) into Monaco for the WDL language. */
  export function registerWadiLsp(hooks: LspHooks): void;
}
