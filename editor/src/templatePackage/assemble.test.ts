import { describe, it, expect } from "vitest";
import { assembleTemplatePackage, normalizeId } from "./assemble";

const compiled = {
  site: { plot_width: 220, plot_length: 340 },
  variables: { plot_w: 220 },
  configurator: { inputs: [{ target: "plot_w", label: "Width", control: "slider" }] },
  floors: [
    { name: "Ground", objects: [{ type: "room", name: "Bedroom" }, { type: "room", name: "Bath" }] },
  ],
};

describe("assembleTemplatePackage", () => {
  it("normalizeId slugifies to a filename-safe key", () => {
    expect(normalizeId("  My Cool House! ")).toBe("my_cool_house");
    expect(normalizeId("already_ok")).toBe("already_ok");
  });

  it("attaches captured thumbnails and preserves the parametric layer", () => {
    const pkg = assembleTemplatePackage(compiled, ["data:img/a", "data:img/b"], {
      id: "Coastal Home",
      title: "Coastal Home",
      description: "A breezy home.",
      style: "Konkan",
      roof: "Gable",
      tags: ["coastal", "compact"],
    });
    expect(pkg.file).toBe("coastal_home.wadi");
    expect(pkg.wadi.thumbnails).toEqual(["data:img/a", "data:img/b"]);
    // the config is now self-describing: editorial folded into a `template` block
    expect(pkg.wadi.template).toEqual({
      title: "Coastal Home",
      description: "A breezy home.",
      style: "Konkan",
      roof: "Gable",
      tags: ["coastal", "compact"],
    });
    expect(pkg.entry.meta.tags).toEqual(["coastal", "compact"]);
    // the parametric layer survives so owners can adjust the published template
    expect(pkg.wadi.variables).toEqual({ plot_w: 220 });
    expect(pkg.wadi.configurator).toBeTruthy();
    // derived + editorial meta
    expect(pkg.entry).toMatchObject({
      id: "coastal_home",
      title: "Coastal Home",
      description: "A breezy home.",
      file: "coastal_home.wadi",
      meta: { bedrooms: 1, bathrooms: 1, floors: 1, style: "Konkan", roof: "Gable", parametric: true },
    });
  });

  it("drops thumbnails when none captured, and never carries legacy singular", () => {
    const withLegacy = { ...compiled, thumbnail: "data:old", thumbnails: ["data:old2"] };
    const pkg = assembleTemplatePackage(withLegacy, [], { id: "x_home", title: "X" });
    expect("thumbnails" in pkg.wadi).toBe(false);
    expect("thumbnail" in pkg.wadi).toBe(false);
  });

  it("throws on an empty id", () => {
    expect(() => assembleTemplatePackage(compiled, [], { id: "  !!! " })).toThrow(/id is required/);
  });
});
