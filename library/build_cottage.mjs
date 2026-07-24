// Fully-parametric single-story Konkan house (majghar-centric).
// Clean 3-layer structure:
//   1. variables      — knobs (dims + standard opening sizes)
//   2. size points    — each room's INTERNAL floor size (fixed rooms are literals,
//                       absorbers/full-width rooms are formulas)
//   3. grid points    — every room's CORNERS (top-left / bottom-right). ALL the wall
//                       math (+wallC / +wallT / envelope) lives here.
// Rooms just link to two corners: x=TL.X, y=TL.Y, width=BR.X−TL.X, length=BR.Y−TL.Y.
// Openings are standard sizes, positioned by formula from the room's corner span.
import { writeFileSync } from "node:fs";

const variables = {
  floorH: 98, slabH: 8, wallT: 8,
  wallC: "=2*wallT", wallH: "=floorH-slabH",
  pillarT: 10,
  doorW: 32, doorH: 70,
  doorMargin: "=wallT",             // internal doors sit this far from a corner (conserves wall)
  winW: 45, winH: 45, winSill: 30,
  bathWinW: 28,
  entranceW: 56, rearDoorW: 72,
  // ROOM PROPORTIONS — a fixed room's dim = max(minimum, pct × House dim). Widths
  // scale with House.W, depths with House.L. The absorbers (Living, Majghar) take the
  // rest, so the fixed percentages must leave them room. This is a reusable convention.
  pctVerandahL: 0.15, minVerandahL: 60,
  pctBedroomW: 0.40, minBedroomW: 100,
  pctBedroomL: 0.28, minBedroomL: 110,
  pctKitchenL: 0.20, minKitchenL: 84,
  pctBathroomW: 0.20, minBathroomW: 70,
  pctBathroomL: 0.13, minBathroomL: 70,
};

// ---- (2) size points: INTERNAL floor sizes (x = width, y = length) ----------
const sizePoints = {
  House: { x: 300, y: 460 },                                              // envelope
  // Fixed rooms are PROPORTIONAL: dim = max(minimum, pct × House dim), so they
  // scale with the plot but never drop below a usable minimum. Widths key off
  // House.W, depths off House.L. round() keeps whole units; the absorbers below
  // soak up any rounding so the plot still fills exactly.
  Verandah: { x: "=House.W-wallC", y: "=max(minVerandahL, round(pctVerandahL*House.L))" },   // full-width
  Bedroom: { x: "=max(minBedroomW, round(pctBedroomW*House.W))", y: "=max(minBedroomL, round(pctBedroomL*House.L))" },
  Kitchen: { x: "=Living.W", y: "=max(minKitchenL, round(pctKitchenL*House.L))" },            // right column
  Bathroom: { x: "=max(minBathroomW, round(pctBathroomW*House.W))", y: "=max(minBathroomL, round(pctBathroomL*House.L))" }, // narrow
  Padvi: { x: "=House.W-Bathroom.W-3*wallT", y: "=Bathroom.L" },         // rest of width, back band depth
  // absorbers (fill the remainder of their column):
  Living: { x: "=House.W-Bedroom.W-3*wallT", y: "=House.L-Verandah.L-Kitchen.L-Padvi.L-5*wallT" },
  Majghar: { x: "=Bedroom.W", y: "=House.L-Verandah.L-Bedroom.L-Bathroom.L-5*wallT" },
};

// ---- (3) grid points: room CORNERS (carry all the wall math) ----------------
const gridPoints = {
  Ver_TL: { x: 0, y: 0 },
  Ver_BR: { x: "=House.W", y: "=Verandah.L+wallC" },
  Bed_TL: { x: 0, y: "=Verandah.L+wallT" },
  Bed_BR: { x: "=Bedroom.W+wallC", y: "=Bed_TL.Y+Bedroom.L+wallC" },
  Maj_TL: { x: 0, y: "=Bed_TL.Y+Bedroom.L+wallT" },
  Maj_BR: { x: "=Bedroom.W+wallC", y: "=Maj_TL.Y+Majghar.L+wallC" },
  Liv_TL: { x: "=Bedroom.W+wallT", y: "=Verandah.L+wallT" },
  Liv_BR: { x: "=House.W", y: "=Liv_TL.Y+Living.L+wallC" },
  Kit_TL: { x: "=Bedroom.W+wallT", y: "=Liv_TL.Y+Living.L+wallT" },
  Kit_BR: { x: "=House.W", y: "=Kit_TL.Y+Kitchen.L+wallC" },
  // back band: Padvi (west, full width less the bathroom) + Bathroom (east back-right
  // corner — sits under the Kitchen so all wet services share the east wall).
  Padvi_TL: { x: 0, y: "=House.L-Padvi.L-wallC" },
  Padvi_BR: { x: "=House.W-Bathroom.W-wallT", y: "=House.L" },
  Bath_TL: { x: "=House.W-Bathroom.W-wallC", y: "=House.L-Padvi.L-wallC" },
  Bath_BR: { x: "=House.W", y: "=House.L" },
  // pillar-line points (front / rear entrance flanks)
  Front_2: { x: "=House.W/2-entranceW/2-pillarT", y: 0 },
  Front_3: { x: "=House.W/2+entranceW/2", y: 0 },
  // rear door is centred on the PADVI span (not the house — the bathroom eats the
  // left corner), so its flanking pillars must key off the Padvi centre too.
  Rear_2: { x: "=(Padvi_TL.X+Padvi_BR.X)/2-rearDoorW/2-pillarT", y: "=House.L-pillarT" },
  Rear_3: { x: "=(Padvi_TL.X+Padvi_BR.X)/2+rearDoorW/2", y: "=House.L-pillarT" },
};

// ---- opening helpers: offsets from the room's corner span -------------------
const ctrNS = (tl, br, w) => `=((${br}.X-${tl}.X)-(${w}))/2`; // centre on a N/S wall
const ctrEW = (tl, br, w) => `=((${br}.Y-${tl}.Y)-(${w}))/2`; // centre on an E/W wall
// doors tuck into a corner (leave the wall run free). Lo = near start corner,
// Hi = near far corner. Margin = doorMargin.
const loNS = () => `=doorMargin`;
const loEW = () => `=doorMargin`;
const hiNS = (tl, br, w) => `=(${br}.X-${tl}.X)-(${w})-doorMargin`;
const hiEW = (tl, br, w) => `=(${br}.Y-${tl}.Y)-(${w})-doorMargin`;
const win = (name, offset, width = "=winW", height = "=winH", sill = 30) =>
  ({ kind: "window", name, offset, width, height, sill_height: sill });
const door = (name, offset, width = "=doorW", height = "=doorH") => ({ kind: "door", name, offset, width, height });

// ---- rooms: linked to two grid corners only --------------------------------
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

  room("Bedroom", "bedroom", "Bed_TL", "Bed_BR", {
    north: { openings: [win("Bed_Win_N", ctrNS("Bed_TL", "Bed_BR", "winW"))] },
    west: { openings: [win("Bed_Win_W", ctrEW("Bed_TL", "Bed_BR", "winW"))] },
    south: { openings: [door("Bed_to_Majghar", loNS())] },   // tucked at the west corner
    east: {},
  }),

  room("Majghar", "hall", "Maj_TL", "Maj_BR", {
    west: { openings: [win("Majghar_Win_W", ctrEW("Maj_TL", "Maj_BR", "winW"))] },
    // doorway to the Padvi, tucked at the east corner. The whole south wall now sits
    // above the Padvi (bathroom moved east), so the old bathroom-width coupling is gone.
    south: { openings: [door("Majghar_to_Padvi", hiNS("Maj_TL", "Maj_BR", "doorW"))] },
  }),

  room("Living", "living", "Liv_TL", "Liv_BR", {
    north: { openings: [door("Living_Entry", ctrNS("Liv_TL", "Liv_BR", "entranceW"), "=entranceW")] },
    east: { openings: [
      win("Living_Win_E1", "=(Liv_BR.Y-Liv_TL.Y)/4-winW/2"),
      win("Living_Win_E2", "=3*(Liv_BR.Y-Liv_TL.Y)/4-winW/2"),
    ] },
    // door into the majghar, tucked at the south corner (which is inside the overlap)
    west: { openings: [door("Living_to_Majghar", hiEW("Liv_TL", "Liv_BR", "doorW"))] },
  }),

  room("Kitchen", "kitchen", "Kit_TL", "Kit_BR", {
    north: {},
    east: { openings: [win("Kitchen_Win_E", ctrEW("Kit_TL", "Kit_BR", "winW"))] },
    west: { openings: [door("Kitchen_to_Majghar", loEW())] },       // tucked at the north corner
    south: { openings: [door("Kitchen_to_Padvi", loNS())] },        // tucked at the west corner
  }),

  room("Bathroom", "bathroom", "Bath_TL", "Bath_BR", {
    // entered from the Padvi (west wall); window on the external east wall. North wall
    // is covered by the Kitchen above, so it isn't redeclared here.
    west: { openings: [door("Bath_to_Padvi", loEW())] },
    east: { openings: [win("Bath_Win_E", ctrEW("Bath_TL", "Bath_BR", "bathWinW"), "=bathWinW", "=winH", 40)] },
    south: {},
  }),

  room("Padvi", "verandah", "Padvi_TL", "Padvi_BR", {
    south: { openings: [door("Rear_Entrance", ctrNS("Padvi_TL", "Padvi_BR", "rearDoorW"), "=rearDoorW")] },
    west: {},   // east wall belongs to the Bathroom (declared there, with its door)
  }, 30),
];

// move formula-string offset/width/height into an opening `formulas` map
for (const r of rooms) for (const side of Object.values(r.walls)) for (const op of side.openings ?? []) {
  const fm = {};
  for (const k of ["offset", "width", "height"]) {
    if (typeof op[k] === "string" && op[k].startsWith("=")) { fm[k] = op[k]; op[k] = 0; }
  }
  if (Object.keys(fm).length) op.formulas = fm;
}

// ---- pillars / roof / plinth (also linked to grid points) ------------------
// Square footprint: BOTH width and length = pillarT (else L keeps a renderer
// default and the `House.W/L - pillarT` corner offsets stop matching the pillar).
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
  pillar("Padvi_Pillar_1", "Padvi_TL.X", "House.L-pillarT"),   // Padvi's left corner (past the bathroom)
  pillar("Padvi_Pillar_2", "Rear_2.X", "Rear_2.Y"),
  pillar("Padvi_Pillar_3", "Rear_3.X", "Rear_3.Y"),
  pillar("Padvi_Pillar_4", "House.W-pillarT", "House.L-pillarT"),   // house SE corner (bathroom's outer corner)
];
const slab = () => ({ type: "floor_slab", formulas: { width: "=House.W", length: "=House.L" }, x: 0, y: 0, width: 300, length: 460 });

const roof = {
  type: "roof", roof_type: "pitched", default_endpoint: "closed", name: "Main Roof", material: "roof",
  segments: [{
    id: "seg0", start: [150, 0], end: [150, 460], width: 300,
    hip_setback_start: 72, hip_setback_end: 66,
    hip_ridge_extension_start: 40, hip_ridge_extension_end: 40,
    formulas: {
      start_x: "=House.W/2", end_x: "=House.W/2", end_y: "=House.L", width: "=House.W",
      hip_setback_start: "=Verandah.L", hip_setback_end: "=Padvi.L",
    },
    tie_beam_count: 3,
  }],
  slope: { by: "height", ridge_h: 75 },
  min_overhang: 25,
  trusses: [{
    segment_id: "seg0", type: "fink", positions_along: [84, 234, 384],
    formulas: { pos0: "=Bed_TL.Y", pos1: "=(Bed_TL.Y+Bath_TL.Y)/2", pos2: "=Bath_TL.Y" },
  }],
};

const plinthObj = (type, layer, name, extra = {}) => ({
  type, layer, name,
  formulas: { x: "=Ver_TL.X", y: "=Ver_TL.Y", width: "=House.W", length: "=House.L" },
  x: 0, y: 0, width: 300, length: 460, ...extra,
});

const config = {
  site: { reference_x: 0, reference_y: 0, plot_length: 460, plot_width: 300, formulas: { plot_width: "=House.W", plot_length: "=House.L" } },
  defaults: { floor_height: 98, wall_height: 90, slab_thickness: 8, wall_thickness: 8, formulas: { wall_thickness: "=wallT", slab_thickness: "=wallT", floor_height: "=floorH", wall_height: "=wallH" } },
  variables,
  points: { ...sizePoints, ...gridPoints },
  floors: [
    { floor_number: 0, name: "Plinth", height: 30, objects: [
      plinthObj("ground", "ground", "Ground"),
      plinthObj("plinth", "plinth", "Plinth", { height: 30 }),
    ] },
    { floor_number: 1, name: "Ground Floor", objects: [slab(), ...pillars, ...rooms] },
    { floor_number: 2, name: "Loft Floor", objects: [roof] },
  ],
};

writeFileSync(new URL("./single_story_cottage.wadi", import.meta.url), JSON.stringify(config, null, 1));
console.log("wrote single_story_cottage.wadi");
