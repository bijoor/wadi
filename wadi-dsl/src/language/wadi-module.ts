// Headless Langium services for the Wadi DSL (core services only — no LSP —
// since we only parse + generate). EmptyFileSystem = in-memory documents.

import { type Module, inject, EmptyFileSystem } from "langium";
import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  type DefaultSharedCoreModuleContext,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
  type PartialLangiumCoreServices,
} from "langium";
import { WadiGeneratedModule, WadiGeneratedSharedModule } from "./generated/module.js";
import { WadiScopeProvider } from "./wadi-scope.js";
import { registerWadiValidationChecks } from "./wadi-validator.js";
import { WadiTokenBuilder } from "./wadi-token-builder.js";

export type WadiServices = LangiumCoreServices;

// Inject the module-aware ScopeProvider so `use`/`item` cross-references resolve
// across imported-module documents (see wadi-scope.ts).
export const WadiModule: Module<WadiServices, PartialLangiumCoreServices> = {
  references: {
    ScopeProvider: (services) => new WadiScopeProvider(services),
  },
  parser: {
    // Soft (contextual) keywords: field-marker keywords are also lexed as ID.
    TokenBuilder: () => new WadiTokenBuilder(),
  },
};

export function createWadiServices(context: DefaultSharedCoreModuleContext = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), WadiGeneratedSharedModule);
  const Wadi = inject(createDefaultCoreModule({ shared }), WadiGeneratedModule, WadiModule);
  shared.ServiceRegistry.register(Wadi);
  registerWadiValidationChecks(Wadi);
  return { shared, Wadi };
}
