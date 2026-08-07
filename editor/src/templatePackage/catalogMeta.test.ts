import { describe, it, expect } from "vitest";
import {
  countRooms,
  countFloors,
  isParametric,
  defaultPlotFt,
  deriveTemplateEntry,
  titleCase,
} from "./catalogMeta";

// The template-catalog meta derivation, shared by scripts/gen-catalog-index.ts and
// the in-app Publish panel. Pure — same result in Node and the browser.

const cfg = {
  site: { plot_width: 300, plot_length: 460 },
  variables: { plot_w: 300 },
  floors: [
    { name: "Plinth", objects: [{ type: "plinth" }] },
    {
      name: "Ground",
      objects: [
        { type: "room", name: "Bedroom 1" },
        { type: "room", name: "Master Bed" },
        { type: "room", name: "Bathroom" },
        { type: "room", name: "WC" },
        { type: "room", name: "Living" },
        { type: "pillar" },
      ],
    },
    { name: "Loft", objects: [{ type: "room", name: "Store" }] },
  ],
};

describe("catalogMeta — template catalog derivation", () => {
  it("counts bedrooms/bathrooms by room name", () => {
    expect(countRooms(cfg)).toEqual({ bedrooms: 2, bathrooms: 2 });
  });

  it("counts only habitable storeys (excludes plinth/loft/roof)", () => {
    expect(countFloors(cfg)).toBe(1);
    expect(countFloors({ floors: [] })).toBe(1); // never below 1
  });

  it("parametric iff variables are declared", () => {
    expect(isParametric(cfg)).toBe(true);
    expect(isParametric({ floors: [] })).toBe(false);
    expect(isParametric({ variables: {} })).toBe(false);
  });

  it("default plot in display-feet (10 units = 1 ft)", () => {
    expect(defaultPlotFt(cfg)).toEqual({ minWidthFt: 30, minLengthFt: 46 });
    expect(defaultPlotFt({})).toEqual({ minWidthFt: 30, minLengthFt: 40 }); // placeholders
  });

  it("titleCase turns an id into a readable title", () => {
    expect(titleCase("single_story_cottage")).toBe("Single Story Cottage");
  });

  it("deriveTemplateEntry: derives counts, takes editorial from prev", () => {
    const entry = deriveTemplateEntry("my_home", cfg, "my_home.wadi", {
      title: "My Home",
      description: "A home.",
      style: "Konkan",
      roof: "Hip",
      minWidthFt: 22,
      minLengthFt: 34,
    });
    expect(entry).toEqual({
      id: "my_home",
      title: "My Home",
      description: "A home.",
      file: "my_home.wadi",
      meta: {
        bedrooms: 2,
        bathrooms: 2,
        floors: 1,
        style: "Konkan",
        roof: "Hip",
        minWidthFt: 22,
        minLengthFt: 34,
        parametric: true,
      },
    });
  });

  it("deriveTemplateEntry: placeholders when no editorial given", () => {
    const entry = deriveTemplateEntry("my_home", cfg, "my_home.wadi");
    expect(entry.title).toBe("My Home");
    expect(entry.description).toBe("");
    expect(entry.meta.style).toBe("—");
    expect(entry.meta.roof).toBe("—");
    expect(entry.meta.minWidthFt).toBe(30); // from plot
  });
});
