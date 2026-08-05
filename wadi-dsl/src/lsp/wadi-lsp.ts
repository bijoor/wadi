// In-process Langium LSP for the WDL editor. Builds FULL Langium services (core
// + LSP providers) with the module-aware WadiScopeProvider, so the same linking
// that drives the compiler also powers editor completion / hover / go-to-def /
// find-references / rename. No worker, no language client: the Monaco providers
// (playground/lsp.ts) call these services directly on the main thread, where the
// `import` module cache already lives.

import { DocumentState, EmptyFileSystem, URI, inject, type LangiumDocument } from "langium";
import {
  createDefaultModule,
  createDefaultSharedModule,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
} from "langium/lsp";
import { WadiGeneratedModule, WadiGeneratedSharedModule } from "../language/generated/module.js";
import { WadiScopeProvider, moduleUri } from "../language/wadi-scope.js";
import type { Model } from "../language/generated/ast.js";
import type { ResolveModule } from "../generator/toHouseConfig.js";

/** Full Langium services (core + LSP), with the Wadi module-aware ScopeProvider
 *  injected so cross-module `use`/`item` references resolve for the editor too. */
export function createWadiLspServices(context: DefaultSharedModuleContext = EmptyFileSystem): {
  shared: LangiumSharedServices;
  Wadi: LangiumServices;
} {
  const shared = inject(createDefaultSharedModule(context), WadiGeneratedSharedModule);
  const Wadi = inject(createDefaultModule({ shared }), WadiGeneratedModule, {
    references: { ScopeProvider: (services) => new WadiScopeProvider(services) },
  });
  shared.ServiceRegistry.register(Wadi);
  return { shared, Wadi };
}

/** The editor document's URI in the Langium workspace. Go-to-def / references
 *  targets carrying this URI map back to the open Monaco model; any other URI is
 *  an imported library module. */
export const LSP_ENTRY_URI = "memory:///__lsp_entry__.wdl";

export interface LspWorkspace {
  entry: LangiumDocument<Model>;
}

/** (Re)build the editor workspace: parse the current text as the entry document
 *  plus every module it transitively imports (from the cache/std packs), then run
 *  DocumentBuilder so references are linked AND indexed (find-references / rename
 *  need the cross-document reference index). Lenient: an unresolvable import is
 *  left dangling rather than throwing, so the editor keeps working as you type. */
export async function buildLspWorkspace(
  shared: LangiumSharedServices,
  text: string,
  resolveModule?: ResolveModule,
): Promise<LspWorkspace> {
  const docs = shared.workspace.LangiumDocuments;
  const factory = shared.workspace.LangiumDocumentFactory;
  for (const d of [...docs.all]) docs.deleteDocument(d.uri);

  const built: LangiumDocument[] = [];
  const parse = (t: string, uri: URI): LangiumDocument<Model> => {
    const doc = factory.fromString<Model>(t, uri);
    docs.addDocument(doc);
    built.push(doc);
    return doc;
  };

  const entry = parse(text, URI.parse(LSP_ENTRY_URI));
  const seen = new Set<string>([LSP_ENTRY_URI]);
  const walk = (model: Model) => {
    for (const imp of model.imports) {
      const uri = moduleUri(imp.ref);
      const key = uri.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      const src = resolveModule?.(imp.ref);
      if (src === undefined) continue; // dangling import — leave it, keep editing
      walk(parse(src, uri).parseResult.value);
    }
  };
  walk(entry.parseResult.value);

  await shared.workspace.DocumentBuilder.build(built, { validation: false });
  // Guard: ensure linking has advanced (build resolves this, but be explicit).
  for (const d of built) if (d.state < DocumentState.ComputedScopes) d.state = DocumentState.ComputedScopes;
  return { entry };
}
