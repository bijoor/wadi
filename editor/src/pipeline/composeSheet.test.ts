import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composeSheet } from "./composeSheet";
import { resolveParametric } from "../param/resolve";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";
import { setDimensionUnits } from "../svg2d/format";
import { setTextScale, computeTextScale, houseSpanUnits } from "../svg2d/config";

const raw = JSON.parse(
  readFileSync(new URL("../../../house_config.json", import.meta.url), "utf8"),
);

// The direct sequence every SVG caller runs today (preamble → generate).
function directSheet(cfg: unknown) {
  setDimensionUnits((cfg as { units?: unknown }).units as never);
  setTextScale(computeTextScale(houseSpanUnits(cfg as never)));
  const sections = computeRoofSections(cfg as never) as
    | { panels?: { filename: string; content: string }[] }
    | undefined;
  return {
    plans: generateCombinedFloorPlans(cfg as never),
    elevations: generateCombinedElevations(cfg as never),
    roofTop: sections?.panels?.find((p) => p.filename === "roof_top_view.svg")?.content,
  };
}

describe("composeSheet — SVG view leaves as Stages (byte-identical)", () => {
  it("plans / elevations / roofTop match the direct preamble+generate", () => {
    const viaStage = composeSheet(raw);
    const direct = directSheet(resolveParametric(raw).config);
    expect(viaStage.plans).toBe(direct.plans);
    expect(viaStage.elevations).toBe(direct.elevations);
    expect(viaStage.roofTop).toBe(direct.roofTop);
  });

  it("renders only the requested views", () => {
    const only = composeSheet(raw, ["plans"]);
    expect(only.plans).toBeTruthy();
    expect(only.elevations).toBeUndefined();
    expect(only.roofTop).toBeUndefined();
  });
});
