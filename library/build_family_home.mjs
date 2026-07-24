// Fully-parametric single-story Konkan FAMILY HOME (3-bedroom), same recipe as
// the cottage (see .claude/skills/wadi-config/reference/parametric-conventions.md).
// Three columns between a full-width front Verandah and a full-width rear band:
//   left   = 3 bedrooms stacked (Bed2 absorbs the remainder)
//   center = Majghar (the circulation hub, absorbs its column's width + length)
//   right  = Living (absorber) + Kitchen
// Rear band = Padvi (west/centre, open verandah) + Bathroom (east, under the
// Kitchen so wet services share the east wall).
import { writeFileSync } from "node:fs";

const variables = {
  floorH: 100, slabH: 8, wallT: 8,
  wallC: "=2*wallT", wallH: "=floorH-slabH",
  pillarT: 10,
  doorW: 32, doorH: 70,
  doorMargin: "=wallT",
  winW: 45, winH: 45, winSill: 30,
  bathWinW: 28,
  entranceW: 56, rearDoorW: 72,
  // ROOM PROPORTIONS — dim = max(minimum, pct × House dim). Widths key off House.W,
  // depths off House.L; absorbers (Majghar, Living, Bedroom2) take the remainder.
  pctLivW: 0.34, minLivW: 140,       // living/kitchen column width; bedroom column mirrors it (Majghar col = absorber)
  pctVerandahL: 0.12, minVerandahL: 60,
  pctBed1L: 0.26, minBed1L: 120,     // master bedroom (front-left)
  pctBed3L: 0.20, minBed3L: 100,     // rear-left bedroom (Bed2 = absorber)
  pctKitchenL: 0.22, minKitchenL: 110, // Living = absorber
  pctBathL: 0.13, minBathL: 66,      // two bathrooms (SE corner) depth; Padvi depth aligns to this
  passageL: 40,                      // corridor north of the bathrooms (reached from the Majghar)
};

// ---- (2) size points: INTERNAL floor sizes (x = width, y = length) ----------
const sizePoints = {
  House: { x: 400, y: 520 },
  Verandah: { x: "=House.W-wallC", y: "=max(minVerandahL, round(pctVerandahL*House.L))" },
  // column widths
  LivCol:  { x: "=max(minLivW, round(pctLivW*House.W))", y: 0 },
  BedCol:  { x: "=LivCol.W", y: 0 },   // mirror the living column → symmetric layout, centred Majghar
  MajCol:  { x: "=House.W-BedCol.W-LivCol.W-4*wallT", y: 0 },   // centre column = width absorber
  // rear: two bathrooms (SE) under a Passage; the Padvi (verandah) depth aligns to the bath
  Bath:    { x: "=(LivCol.W-wallT)/2", y: "=max(minBathL, round(pctBathL*House.L))" }, // each of the two baths
  Passage: { x: "=LivCol.W", y: "=passageL" },
  // bedroom lengths (left column stack; Bed2 absorbs)
  Bed1: { x: "=BedCol.W", y: "=max(minBed1L, round(pctBed1L*House.L))" },
  Bed3: { x: "=BedCol.W", y: "=max(minBed3L, round(pctBed3L*House.L))" },
  Bed2: { x: "=BedCol.W", y: "=House.L-Verandah.L-Bed1.L-Bed3.L-Bath.L-6*wallT" },
  // right column: Kitchen fixed; Living absorbs (now also minus the Passage)
  Kitchen: { x: "=LivCol.W", y: "=max(minKitchenL, round(pctKitchenL*House.L))" },
  Living:  { x: "=LivCol.W", y: "=House.L-Verandah.L-Kitchen.L-Passage.L-Bath.L-6*wallT" },
  // centre column length absorber (spans front verandah to rear band)
  Majghar: { x: "=MajCol.W", y: "=House.L-Verandah.L-Bath.L-4*wallT" },
  // Padvi (rear verandah) fills west+centre up to the right column
  Padvi:   { x: "=BedCol.W+MajCol.W+wallT", y: "=Bath.L" },
};

// ---- (3) grid points: room CORNERS -----------------------------------------
// x column anchors: Bed | Maj | Liv  (3 columns → 4 vertical walls)
const gridPoints = {
  Ver_TL: { x: 0, y: 0 },
  Ver_BR: { x: "=House.W", y: "=Verandah.L+wallC" },
  // left column (bedrooms), x 0 .. BedCol.W+wallC
  Bed1_TL: { x: 0, y: "=Verandah.L+wallT" },
  Bed1_BR: { x: "=BedCol.W+wallC", y: "=Bed1_TL.Y+Bed1.L+wallC" },
  Bed2_TL: { x: 0, y: "=Bed1_TL.Y+Bed1.L+wallT" },
  Bed2_BR: { x: "=BedCol.W+wallC", y: "=Bed2_TL.Y+Bed2.L+wallC" },
  Bed3_TL: { x: 0, y: "=Bed2_TL.Y+Bed2.L+wallT" },
  Bed3_BR: { x: "=BedCol.W+wallC", y: "=House.L-Bath.L-wallT" },
  // centre column (Majghar), x BedCol.W+wallT .. + MajCol.W+wallC
  Maj_TL: { x: "=BedCol.W+wallT", y: "=Verandah.L+wallT" },
  Maj_BR: { x: "=BedCol.W+wallT+MajCol.W+wallC", y: "=House.L-Bath.L-wallT" },
  // right column (Living + Kitchen + Passage), x LivCol_left .. House.W
  Liv_TL: { x: "=BedCol.W+MajCol.W+2*wallT", y: "=Verandah.L+wallT" },
  Liv_BR: { x: "=House.W", y: "=Liv_TL.Y+Living.L+wallC" },
  Kit_TL: { x: "=BedCol.W+MajCol.W+2*wallT", y: "=Liv_TL.Y+Living.L+wallT" },
  Kit_BR: { x: "=House.W", y: "=Kit_TL.Y+Kitchen.L+wallC" },
  Pass_TL: { x: "=BedCol.W+MajCol.W+2*wallT", y: "=Kit_TL.Y+Kitchen.L+wallT" },
  Pass_BR: { x: "=House.W", y: "=House.L-Bath.L-wallT" },
  // rear: Padvi (west/centre) + two Bathrooms (SE, side by side E-W)
  Padvi_TL: { x: 0, y: "=House.L-Bath.L-wallC" },
  Padvi_BR: { x: "=BedCol.W+wallT+MajCol.W+wallC", y: "=House.L" },   // = Maj_BR.X
  Bath1_TL: { x: "=BedCol.W+MajCol.W+2*wallT", y: "=House.L-Bath.L-wallC" },
  Bath1_BR: { x: "=BedCol.W+MajCol.W+2*wallT+Bath.W+wallC", y: "=House.L" },
  Bath2_TL: { x: "=Bath1_BR.X-wallT", y: "=House.L-Bath.L-wallC" },
  Bath2_BR: { x: "=House.W", y: "=House.L" },
  // pillar-line points
  Front_2: { x: "=House.W/2-entranceW/2-pillarT", y: 0 },
  Front_3: { x: "=House.W/2+entranceW/2", y: 0 },
  Rear_2: { x: "=(Padvi_TL.X+Padvi_BR.X)/2-rearDoorW/2-pillarT", y: "=House.L-pillarT" },
  Rear_3: { x: "=(Padvi_TL.X+Padvi_BR.X)/2+rearDoorW/2", y: "=House.L-pillarT" },
};

// ---- opening helpers --------------------------------------------------------
const ctrNS = (tl, br, w) => `=((${br}.X-${tl}.X)-(${w}))/2`;
const ctrEW = (tl, br, w) => `=((${br}.Y-${tl}.Y)-(${w}))/2`;
const loNS = () => `=doorMargin`;
const loEW = () => `=doorMargin`;
const hiNS = (tl, br, w) => `=(${br}.X-${tl}.X)-(${w})-doorMargin`;
const hiEW = (tl, br, w) => `=(${br}.Y-${tl}.Y)-(${w})-doorMargin`;
const win = (name, offset, width = "=winW", height = "=winH", sill = 30) =>
  ({ kind: "window", name, offset, width, height, sill_height: sill });
const door = (name, offset, width = "=doorW", height = "=doorH") => ({ kind: "door", name, offset, width, height });

const room = (name, material, tl, br, walls, height) => ({
  type: "room", name, material,
  formulas: { x: `=${tl}.X`, y: `=${tl}.Y`, width: `=${br}.X-${tl}.X`, length: `=${br}.Y-${tl}.Y` },
  x: 0, y: 0, width: 0, length: 0, ...(height !== undefined ? { height } : {}), walls,
});

const rooms = [
  room("Verandah", "verandah", "Ver_TL", "Ver_BR", {
    north: { openings: [door("Entrance", ctrNS("Ver_TL", "Ver_BR", "entranceW"), "=entranceW")] },
    east: {}, west: {},
  }, 30),

  // left column — 3 bedrooms; each opens EAST into the Majghar, window on the WEST wall
  room("Master_Bedroom", "bedroom", "Bed1_TL", "Bed1_BR", {
    west: { openings: [win("Bed1_Win_W", ctrEW("Bed1_TL", "Bed1_BR", "winW"))] },
    east: { openings: [door("Bed1_to_Majghar", hiEW("Bed1_TL", "Bed1_BR", "doorW"))] },
    north: {}, south: {},
  }),
  room("Bedroom_2", "bedroom", "Bed2_TL", "Bed2_BR", {
    west: { openings: [win("Bed2_Win_W", ctrEW("Bed2_TL", "Bed2_BR", "winW"))] },
    east: { openings: [door("Bed2_to_Majghar", loEW())] },
    south: {},
  }),
  room("Bedroom_3", "bedroom", "Bed3_TL", "Bed3_BR", {
    west: { openings: [win("Bed3_Win_W", ctrEW("Bed3_TL", "Bed3_BR", "winW"))] },
    east: { openings: [door("Bed3_to_Majghar", loEW())] },
    south: {},
  }),

  // centre — the hub. Doors from the bedrooms (west) and living/kitchen (east)
  // are declared on THOSE rooms; Majghar only declares its rear door to the Padvi.
  room("Majghar", "hall", "Maj_TL", "Maj_BR", {
    // main entry from the Verandah (this also is the Verandah's south wall over
    // the central bay — the neighbouring bedrooms/living declare the rest of it).
    north: { openings: [door("Majghar_Entry", ctrNS("Maj_TL", "Maj_BR", "entranceW"), "=entranceW")] },
    south: { openings: [door("Majghar_to_Padvi", hiNS("Maj_TL", "Maj_BR", "doorW"))] },
  }),

  // right column — Living (front) + Kitchen (rear); both open WEST into the Majghar
  room("Living", "living", "Liv_TL", "Liv_BR", {
    east: { openings: [
      win("Living_Win_E1", "=(Liv_BR.Y-Liv_TL.Y)/4-winW/2"),
      win("Living_Win_E2", "=3*(Liv_BR.Y-Liv_TL.Y)/4-winW/2"),
    ] },
    west: { openings: [door("Living_to_Majghar", loEW())] },
    north: {},
  }),
  room("Kitchen", "kitchen", "Kit_TL", "Kit_BR", {
    north: {},   // partition with the Living above (declared here so it's drawn)
    east: { openings: [win("Kitchen_Win_E", ctrEW("Kit_TL", "Kit_BR", "winW"))] },
    west: { openings: [door("Kitchen_to_Majghar", loEW())] },
    south: {},   // partition with the Passage below
  }),

  // passage north of the two bathrooms — its WEST side is open to the Majghar (no
  // wall declared there), so the hall flows straight into it.
  room("Passage", "hall", "Pass_TL", "Pass_BR", {
    east: {},    // external east wall
  }),

  // rear band: Padvi (rear verandah) west/centre; two bathrooms in the SE corner,
  // doors opening NORTH into the Passage.
  room("Padvi", "verandah", "Padvi_TL", "Padvi_BR", {
    south: { openings: [door("Rear_Entrance", ctrNS("Padvi_TL", "Padvi_BR", "rearDoorW"), "=rearDoorW")] },
    west: {},    // east wall belongs to Bathroom_1
  }, 30),
  room("Bathroom_1", "bathroom", "Bath1_TL", "Bath1_BR", {
    north: { openings: [door("Bath1_to_Passage", hiNS("Bath1_TL", "Bath1_BR", "doorW"))] },
    west: {},    // shared with the Padvi
    south: { openings: [win("Bath1_Win_S", ctrNS("Bath1_TL", "Bath1_BR", "bathWinW"), "=bathWinW", "=winH", 40)] },
  }),
  room("Bathroom_2", "bathroom", "Bath2_TL", "Bath2_BR", {
    north: { openings: [door("Bath2_to_Passage", loNS())] },
    west: {},    // partition with Bathroom_1
    east: { openings: [win("Bath2_Win_E", ctrEW("Bath2_TL", "Bath2_BR", "bathWinW"), "=bathWinW", "=winH", 40)] },
    south: {},   // external rear wall
  }),
];

// move formula-string offset/width/height into an opening `formulas` map
for (const r of rooms) for (const side of Object.values(r.walls)) for (const op of side.openings ?? []) {
  const fm = {};
  for (const k of ["offset", "width", "height"]) {
    if (typeof op[k] === "string" && op[k].startsWith("=")) { fm[k] = op[k]; op[k] = 0; }
  }
  if (Object.keys(fm).length) op.formulas = fm;
}

// ---- pillars / roof / plinth ------------------------------------------------
const pillar = (name, gx, gy) => ({
  type: "pillar", name,
  formulas: { x: `=${gx}`, y: `=${gy}`, width: "=pillarT", length: "=pillarT", height: "=floorH" },
  x: 0, y: 0, width: 10, length: 10, height: 98,
});
const pillars = [
  pillar("Verandah_Pillar_1", "Ver_TL.X", "Ver_TL.Y"),
  pillar("Verandah_Pillar_2", "Front_2.X", "Front_2.Y"),
  pillar("Verandah_Pillar_3", "Front_3.X", "Front_3.Y"),
  pillar("Verandah_Pillar_4", "House.W-pillarT", "0"),
  pillar("Padvi_Pillar_1", "Padvi_TL.X", "House.L-pillarT"),
  pillar("Padvi_Pillar_2", "Rear_2.X", "Rear_2.Y"),
  pillar("Padvi_Pillar_3", "Rear_3.X", "Rear_3.Y"),
  pillar("Padvi_Pillar_4", "Padvi_BR.X-pillarT", "House.L-pillarT"),   // Padvi's east corner (bathrooms are enclosed, no pillar)
];
const slab = () => ({ type: "floor_slab", formulas: { width: "=House.W", length: "=House.L" }, x: 0, y: 0, width: 400, length: 520 });

const roof = {
  type: "roof", roof_type: "pitched", default_endpoint: "closed", name: "Main Roof", material: "roof",
  segments: [{
    id: "seg0", start: [200, 0], end: [200, 520], width: 400,
    hip_setback_start: 62, hip_setback_end: 73,
    hip_ridge_extension_start: 40, hip_ridge_extension_end: 40,
    formulas: {
      start_x: "=House.W/2", end_x: "=House.W/2", end_y: "=House.L", width: "=House.W",
      hip_setback_start: "=Verandah.L", hip_setback_end: "=Bath.L",
    },
    tie_beam_count: 3,
  }],
  slope: { by: "height", ridge_h: 80 },
  min_overhang: 25,
  trusses: [{
    segment_id: "seg0", type: "fink", positions_along: [110, 280, 450],
    formulas: { pos0: "=Bed1_TL.Y", pos1: "=(Bed1_TL.Y+Padvi_TL.Y)/2", pos2: "=Padvi_TL.Y" },
  }],
};

const plinthObj = (type, layer, name, extra = {}) => ({
  type, layer, name,
  formulas: { x: "=Ver_TL.X", y: "=Ver_TL.Y", width: "=House.W", length: "=House.L" },
  x: 0, y: 0, width: 400, length: 520, ...extra,
});

// Gharkul (owner) configurator: the knobs an end user tunes.
const configurator = {
  title: "Configure your family home",
  description: "Adjust the plot, rooms and construction — the whole house re-flows to fit.",
  groups: [
    { id: "size", label: "Plot" },
    { id: "rooms", label: "Rooms" },
    { id: "build", label: "Construction" },
  ],
  inputs: [
    { target: "House.W", label: "Plot width", description: "Overall east–west width.", unit: "ft", min: 340, max: 520, step: 10, group: "size" },
    { target: "House.L", label: "Plot length", description: "Overall north–south length.", unit: "ft", min: 460, max: 640, step: 10, group: "size" },
    { target: "pctVerandahL", label: "Verandah depth", description: "Front verandah depth, as a share of the plot length.", unit: "percent", min: 0.1, max: 0.2, step: 0.01, group: "rooms" },
    { target: "pctLivW", label: "Side-room width", description: "Bedroom & living column width as a share of the plot.", unit: "percent", min: 0.3, max: 0.4, step: 0.01, group: "rooms" },
    { target: "minBathL", label: "Bathroom depth (min)", description: "Smallest the two bathrooms get.", unit: "ft", min: 60, max: 90, step: 2, group: "rooms" },
    // Constants shown as OPTIONS (dropdowns) rather than sliders.
    { target: "floorH", label: "Ceiling height", description: "Floor-to-floor height.", group: "build",
      options: [{ value: 90, label: "9 ft" }, { value: 100, label: "10 ft (standard)" }, { value: 110, label: "11 ft" }, { value: 120, label: "12 ft" }] },
    { target: "wallT", label: "Wall thickness", description: "External wall thickness.", group: "build",
      options: [{ value: 6, label: "Thin" }, { value: 8, label: "Standard" }, { value: 10, label: "Thick" }] },
  ],
};

const config = {
  site: { reference_x: 0, reference_y: 0, plot_length: 520, plot_width: 400, formulas: { plot_width: "=House.W", plot_length: "=House.L" } },
  defaults: { floor_height: 98, wall_height: 90, slab_thickness: 8, wall_thickness: 8, formulas: { wall_thickness: "=wallT", slab_thickness: "=wallT", floor_height: "=floorH", wall_height: "=wallH" } },
  variables,
  points: { ...sizePoints, ...gridPoints },
  configurator,
  floors: [
    { floor_number: 0, name: "Plinth", height: 30, objects: [
      plinthObj("ground", "ground", "Ground"),
      plinthObj("plinth", "plinth", "Plinth", { height: 30 }),
    ] },
    { floor_number: 1, name: "Ground Floor", objects: [slab(), ...pillars, ...rooms] },
    { floor_number: 2, name: "Loft Floor", objects: [roof] },
  ],
};

writeFileSync(new URL("./family_home.wadi", import.meta.url), JSON.stringify(config, null, 1));
console.log("wrote family_home.wadi");
