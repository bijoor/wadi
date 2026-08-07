import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { orderStages, runStages, type Stage } from "./stageRunner";
import { resolveParametric } from "../param/resolve";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";

describe("Stage runner — mechanics", () => {
  type C = { log: string[] };
  const mk = (id: string, dependsOn?: string[]): Stage<C> => ({
    id,
    dependsOn,
    run: (ctx) => ({ log: [...ctx.log, id] }),
  });

  it("orders by dependsOn (deps before dependents), deterministic", () => {
    // c→b→a, plus an independent d after b in input order.
    const order = orderStages([mk("c", ["b"]), mk("d"), mk("b", ["a"]), mk("a")]).map((s) => s.id);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    expect(order).toContain("d");
  });

  it("folds outputs in dependency order", () => {
    const out = runStages([mk("c", ["b"]), mk("b", ["a"]), mk("a")], { log: [] });
    expect(out.log).toEqual(["a", "b", "c"]);
  });

  it("a read-only (void) stage leaves ctx unchanged", () => {
    const seen: string[] = [];
    const probe: Stage<C> = { id: "probe", dependsOn: ["a"], run: (ctx) => void seen.push(...ctx.log) };
    const out = runStages([probe, mk("a")], { log: [] });
    expect(out.log).toEqual(["a"]);
    expect(seen).toEqual(["a"]);
  });

  it("throws on a cycle", () => {
    expect(() => orderStages([mk("a", ["b"]), mk("b", ["a"])])).toThrow(/cycle/);
  });

  it("throws on an unknown dependency", () => {
    expect(() => orderStages([mk("a", ["missing"])])).toThrow(/unknown stage "missing"/);
  });

  it("throws on a duplicate id", () => {
    expect(() => orderStages([mk("a"), mk("a")])).toThrow(/duplicate stage id/);
  });
});

describe("Stage runner — reproduces Wadi's real resolve→expand derivation", () => {
  // The compositor's shared prefix expressed as two stages. Proving the generic
  // runner yields byte-identical output to the direct calls the app makes today —
  // on a real config — validates the DAG abstraction on actual Wadi data before
  // any renderer is routed through it.
  type Ctx = { raw: unknown; resolved?: HouseConfig; expanded?: unknown };
  const resolveStage: Stage<Ctx> = {
    id: "resolve",
    run: (ctx) => ({ resolved: resolveParametric(ctx.raw as never).config as HouseConfig }),
  };
  const expandStage: Stage<Ctx> = {
    id: "expand",
    dependsOn: ["resolve"],
    run: (ctx) => ({ expanded: expandRoomWalls(ctx.resolved!) }),
  };

  const raw = JSON.parse(
    readFileSync(new URL("../../../house_config.json", import.meta.url), "utf8"),
  );

  it("runStages([expand, resolve]) === direct resolve→expand (toposort reorders)", () => {
    // Deliberately pass stages out of order — the runner must reorder them.
    const out = runStages([expandStage, resolveStage], { raw });
    const direct = expandRoomWalls(resolveParametric(raw).config as never);
    expect(out.expanded).toEqual(direct);
  });
});
