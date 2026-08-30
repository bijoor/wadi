// Templates ship a numeric `roof_style` selector (0=Flat,1=Shed,2=Gable,3=Hip)
// and four pre-placed roof objects, each gated by
//   formulas.enabled = "= 1 - min(1, abs(roof_style - N))".
// Selecting a style must leave EXACTLY ONE roof, of the matching type, after
// resolve + expand — the whole point of the enable-per-type approach.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { compileDsl } from "wadi-wdl-compiler";
import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";
import { HouseConfig } from "../schema/houseConfig";

const TEMPLATES = ["family_home", "single_story_cottage"] as const;

// The shipped templates are `.wadi` BUNDLES now; load a template's config the way
// the app does — unzip and compile its model.wdl. This also proves the JSON→bundle
// migration preserved the parametric machinery (variables, configurator, the roof
// enable-per-type formulas) through the WDL round-trip.
function loadTemplateConfig(name: string): Record<string, unknown> {
  const bytes = new Uint8Array(readFileSync(`public/templates/${name}.wadi`));
  const files = unzipSync(bytes);
  const wdl = strFromU8(files["model.wdl"]);
  return compileDsl(wdl) as Record<string, unknown>;
}

// [roof_type, default_endpoint | undefined] expected for each roof_style.
const EXPECTED: Array<[string, string | undefined]> = [
  ["flat", undefined],   // 0
  ["shed", undefined],   // 1
  ["pitched", "open"],   // 2 Gable
  ["pitched", "closed"], // 3 Hip
];

for (const name of TEMPLATES) {
  describe(`template ${name}: roof_style gating`, () => {
    const raw = loadTemplateConfig(name) as {
      variables?: { roof_style?: unknown };
      configurator?: { inputs?: Array<{ target?: string; options?: Array<{ value: number }> }> };
    };

    it("is schema-valid", () => {
      expect(HouseConfig.safeParse(raw).success).toBe(true);
    });

    it("ships the roof_style selector + a configurator select with 4 options", () => {
      expect(typeof raw.variables?.roof_style).toBe("number");
      const input = (raw.configurator?.inputs ?? []).find(
        (i: { target?: string }) => i.target === "roof_style",
      );
      expect(input).toBeTruthy();
      expect(input.options?.map((o: { value: number }) => o.value)).toEqual([0, 1, 2, 3]);
    });

    for (let k = 0; k < 4; k++) {
      it(`roof_style=${k} → exactly one ${EXPECTED[k][0]}/${EXPECTED[k][1] ?? "-"} roof`, () => {
        const cfg = JSON.parse(JSON.stringify(raw));
        cfg.variables.roof_style = k;
        const resolved = resolveParametric(cfg).config as {
          floors?: Array<{ floor_number?: number; objects?: Array<Record<string, unknown>> }>;
        };
        const hc = expandRoomWalls(resolved as never) as typeof resolved;
        const roofs = (hc.floors ?? [])
          .flatMap((f) => f.objects ?? [])
          .filter((o) => o.type === "roof");
        expect(roofs).toHaveLength(1);
        expect(roofs[0].roof_type).toBe(EXPECTED[k][0]);
        expect(roofs[0].default_endpoint).toBe(EXPECTED[k][1]);
      });
    }
  });
}
