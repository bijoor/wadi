// The Wadi ScopeProvider — the reusable heart of the module system. It resolves
// a `use` (→ `component`) or an `item` (→ `asset`) cross-reference by offering,
// for the referring document: (a) that document's own decls by bare name, and
// (b) each `import "ref" as ns`'s exported decls under `ns.Name` (bare imports
// merge in un-namespaced). It reads the imported documents' parsed ASTs straight
// from LangiumDocuments — no IndexManager — so cross-document references resolve
// LAZILY and SYNCHRONOUSLY on `.ref` access, without an async DocumentBuilder
// build. This is the one piece that generalizes across domain DSLs: it is
// parameterised only by "which decl arrays are exportable" (components, assets).

import {
  AstUtils,
  DefaultScopeProvider,
  MapScope,
  URI,
  type AstNode,
  type AstNodeDescription,
  type LangiumCoreServices,
  type LangiumDocument,
  type LangiumDocuments,
  type ReferenceInfo,
  type Scope,
} from "langium";
import type { Model } from "./generated/ast.js";

/** A module ref → its in-memory document URI. The loader registers imported
 *  modules under exactly this URI, and the scope provider looks them up here —
 *  the two must agree. A slash in the ref (e.g. `konkan/base`) is kept literally;
 *  it only needs to be a stable unique key. */
export function moduleUri(ref: string): URI {
  return URI.parse(`memory:///${ref}.wdl`);
}

export class WadiScopeProvider extends DefaultScopeProvider {
  private readonly documents: LangiumDocuments;

  constructor(services: LangiumCoreServices) {
    super(services);
    this.documents = services.shared.workspace.LangiumDocuments;
  }

  override getScope(context: ReferenceInfo): Scope {
    const isAsset = this.reflection.getReferenceType(context) === "AssetDecl";
    const model = AstUtils.getDocument(context.container).parseResult.value as Model;
    const out: AstNodeDescription[] = [];
    const add = (node: AstNode, name: string, d: LangiumDocument) =>
      out.push(this.descriptions.createDescription(node, name, d));

    // Offer a module's exportable decls under `prefix.Name` (prefix "" = bare).
    // `$refText` is unquoted (Langium strips string quotes even in the datatype
    // name rule), so an asset keys as `bed_double`/`f.bed_double`, a component
    // as `Leg`/`kb.Leg`.
    const collect = (m: Model, d: LangiumDocument, prefix: string) => {
      if (isAsset) for (const a of m.assets) add(a, prefix ? `${prefix}.${a.id}` : a.id, d);
      else for (const c of m.components) add(c, prefix ? `${prefix}.${c.name}` : c.name, d);
    };

    // (a) same-document decls (bare); (b) each import's decls under its alias
    // (a bare `import "ref"` merges un-namespaced). Imported ASTs come straight
    // from LangiumDocuments — no async index needed.
    const doc = AstUtils.getDocument(context.container);
    collect(model, doc, "");
    for (const imp of model.imports) {
      const idoc = this.documents.getDocument(moduleUri(imp.ref)) as LangiumDocument | undefined;
      if (!idoc) continue; // unresolved import — reported as a load error upstream
      collect(idoc.parseResult.value as Model, idoc, imp.ns ?? "");
    }
    return new MapScope(out);
  }
}
