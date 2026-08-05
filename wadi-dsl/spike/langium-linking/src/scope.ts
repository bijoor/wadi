// The one reusable piece: a ScopeProvider that implements import + namespace
// visibility. For a `use` reference it offers (a) same-document components by
// bare name, and (b) each `import "path" as ns`'s exported components under
// `ns.Name`, pulled from the cross-document global index. This is what generalizes
// across domain DSLs — it's parameterised only by "the exportable decl type".

import {
  AstUtils,
  DefaultScopeProvider,
  MapScope,
  URI,
  type AstNodeDescription,
  type ReferenceInfo,
  type Scope,
} from "langium";
import type { Model } from "./generated/ast.js";

/** A module name → its in-memory document URI ("lib" → memory:///lib.mini). */
export function moduleUri(path: string): URI {
  return URI.parse(`memory:///${path}.mini`);
}

export class MiniScopeProvider extends DefaultScopeProvider {
  override getScope(context: ReferenceInfo): Scope {
    const doc = AstUtils.getDocument(context.container);
    const model = doc.parseResult.value as Model;
    const out: AstNodeDescription[] = [];

    // (a) same-file components — bare name resolves them.
    for (const c of model.components) {
      out.push(this.descriptions.createDescription(c, c.name, doc));
    }
    // (b) imported components — `import "path" as ns` exposes them as `ns.Name`,
    // read from the global cross-document index (populated by DocumentBuilder).
    for (const imp of model.imports) {
      const uri = moduleUri(imp.path).toString();
      for (const d of this.indexManager.allElements("Component", new Set([uri]))) {
        out.push({ ...d, name: `${imp.ns}.${d.name}` });
      }
    }
    return new MapScope(out);
  }
}
