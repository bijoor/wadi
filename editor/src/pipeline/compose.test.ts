import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composeResolve, composeExpanded, composeStages } from "./compose";
import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";

const raw = JSON.parse(
  readFileSync(new URL("../../../house_config.json", import.meta.url), "utf8"),
);

describe("compose — Wadi's derivation prefix as Stages (drop-in parity)", () => {
  it("composeResolve === resolveParametric (config + warnings)", () => {
    const viaStage = composeResolve(raw);
    const direct = resolveParametric(raw);
    expect(viaStage.config).toEqual(direct.config);
    expect(viaStage.warnings).toEqual(direct.warnings);
  });

  it("composeExpanded === direct resolve→expand", () => {
    const viaStage = composeExpanded(raw);
    const direct = expandRoomWalls(resolveParametric(raw).config as never);
    expect(viaStage).toEqual(direct);
  });

  it("the typed compose registry carries the base stages", () => {
    expect(composeStages().map((s) => s.id)).toEqual(expect.arrayContaining(["resolve", "expand"]));
  });
});
