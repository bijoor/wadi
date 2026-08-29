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
  /** Decompile a HouseConfig back to editable .wdl text. */
  export function emitWdl(config: Record<string, unknown>, houseName?: string): string;
}
