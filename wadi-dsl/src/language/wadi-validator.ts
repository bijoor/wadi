// Descriptor-driven validation for the generic `ObjectDecl` path (P3b). When a
// primitive descriptor is known (kernel seam, ../generator/descriptors), the
// generic form is checked against its `fields`: too many positional args, or a
// field name that isn't declared. Purely data-driven — no per-type code — so a
// contributed primitive gets validation for free. An UNKNOWN type (no descriptor)
// is left alone: the generic pass-through still compiles, and the strict Zod schema
// remains the hard gate downstream.

import type { LangiumCoreServices, ValidationAcceptor, ValidationChecks } from "langium";
import type { ObjectDecl, WadiAstType } from "./generated/ast.js";
import { getDescriptor } from "../generator/descriptors.js";

const unquote = (s: string): string => s.replace(/^"(.*)"$/s, "$1");

export class WadiValidator {
  checkObjectDecl(node: ObjectDecl, accept: ValidationAcceptor): void {
    const desc = getDescriptor(node.type);
    if (!desc) return; // unknown primitive → generic pass-through, nothing to check
    if (node.args.length > desc.positional.length) {
      accept(
        "error",
        `'${node.type}' takes at most ${desc.positional.length} positional argument(s) ` +
          `(${desc.positional.join(", ")}), got ${node.args.length}.`,
        { node, property: "args" },
      );
    }
    for (const fa of node.fields) {
      const key = unquote(fa.key);
      if (key === "name") continue;
      if (!desc.fieldNames.has(key)) {
        accept("warning", `Unknown field '${key}' on '${node.type}'.`, { node: fa, property: "key" });
      }
    }
  }
}

/** Register the generic-primitive checks on a services container (core or LSP). */
export function registerWadiValidationChecks(services: LangiumCoreServices): void {
  const validator = new WadiValidator();
  const checks: ValidationChecks<WadiAstType> = {
    ObjectDecl: (n, a) => validator.checkObjectDecl(n, a),
  };
  services.validation.ValidationRegistry.register(checks, validator);
}
