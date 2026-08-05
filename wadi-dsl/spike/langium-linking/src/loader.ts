// The resolveModule seam, Langium-style: given a { name -> source } map (the
// same shape Wadi's `resolveModule(ref) => text` provides), register the entry
// module AND its transitive imports as in-memory LangiumDocuments, then run
// DocumentBuilder so the linker resolves cross-document references. No filesystem
// (EmptyFileSystem) — identical code path in browser / MCP / CLI.

import { EmptyFileSystem, type LangiumDocument } from "langium";
import { createMiniServices } from "./mini-module.js";
import { moduleUri } from "./scope.js";
import type { Model } from "./generated/ast.js";

export async function buildProject(entry: string, modules: Record<string, string>) {
  const { shared, Mini } = createMiniServices(EmptyFileSystem);
  const docs = shared.workspace.LangiumDocuments;
  const factory = shared.workspace.LangiumDocumentFactory;

  const built: LangiumDocument[] = [];
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const text = modules[name];
    if (text === undefined) throw new Error(`module not found on search path: "${name}"`);
    const doc = factory.fromString<Model>(text, moduleUri(name));
    docs.addDocument(doc);
    built.push(doc);
    // fromString already parsed → walk imports to pull dependencies (transitively).
    for (const imp of doc.parseResult.value.imports) queue.push(imp.path);
  }

  await shared.workspace.DocumentBuilder.build(built, { validation: true });
  return { services: Mini, docs, built };
}
