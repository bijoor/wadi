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

export type WadiServices = LangiumCoreServices;

export const WadiModule: Module<WadiServices, PartialLangiumCoreServices> = {};

export function createWadiServices(context: DefaultSharedCoreModuleContext = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), WadiGeneratedSharedModule);
  const Wadi = inject(createDefaultCoreModule({ shared }), WadiGeneratedModule, WadiModule);
  shared.ServiceRegistry.register(Wadi);
  return { shared, Wadi };
}
