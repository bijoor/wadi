// Core (no-LSP, in-memory) Langium services for the Mini spike, with the custom
// ScopeProvider injected. Same shape as Wadi's wadi-module.ts — the only addition
// is the `references.ScopeProvider` override.

import { type Module, inject, EmptyFileSystem } from "langium";
import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  type DefaultSharedCoreModuleContext,
  type LangiumCoreServices,
  type PartialLangiumCoreServices,
} from "langium";
import { MiniGeneratedModule, MiniGeneratedSharedModule } from "./generated/module.js";
import { MiniScopeProvider } from "./scope.js";

export type MiniServices = LangiumCoreServices;

export const MiniModule: Module<MiniServices, PartialLangiumCoreServices> = {
  references: {
    ScopeProvider: (services) => new MiniScopeProvider(services),
  },
};

export function createMiniServices(context: DefaultSharedCoreModuleContext = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), MiniGeneratedSharedModule);
  const Mini = inject(createDefaultCoreModule({ shared }), MiniGeneratedModule, MiniModule);
  shared.ServiceRegistry.register(Mini);
  return { shared, Mini };
}
