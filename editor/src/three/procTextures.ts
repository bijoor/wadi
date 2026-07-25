// Procedural, OFFLINE (no binary assets) canvas textures for a more realistic
// shell — clay roof tiles + a grassy ground. Generated once from Canvas2D and
// cached, so there's nothing to fetch or bundle. Tier-1 realism pass.
import * as THREE from "three";

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d") as CanvasRenderingContext2D];
}

function toTexture(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ---- Physical texture scaling ----------------------------------------------
// Textures are projected with UV = worldPos * K, so one texture-repeat spans
// 1/K project-units. To keep the *physical* tile size constant across projects
// with different unit settings, K is derived from the project's units:
//   unitsPerFoot = per_unit / FEET_PER_DISPLAY_UNIT[system]
//   K = 1 / (repeatFt * unitsPerFoot)
// `per_unit` is project units per ONE display unit, and the display unit's
// physical size depends on `system` (a "meters" project's per_unit is units
// per metre, not per foot — hence the conversion). Tuned so the default
// (feet_inches, per_unit=10) gives roofUvK=0.013 / wallUvK=0.02.
export interface UnitsRef {
  system?: string;
  per_unit?: number;
}
const DEFAULT_PER_UNIT = 10;
const ROOF_REPEAT_FT = 7.7; // one clay-tile texture repeat ≈ 7.7 ft
const WALL_REPEAT_FT = 5.0; // one laterite-block texture repeat ≈ 5 ft
// How many feet one display unit spans, per units.system (mirrors the map in
// interiorView.ts). feet_inches/feet = 1 ft; metric systems convert.
const FEET_PER_DISPLAY_UNIT: Record<string, number> = {
  feet_inches: 1,
  feet: 1,
  meters: 3.280839895,
  centimeters: 0.032808399,
  millimeters: 0.003280839,
};
function unitsPerFoot(units?: UnitsRef): number {
  const perUnit = units?.per_unit ?? DEFAULT_PER_UNIT;
  const feetPerDisplayUnit = FEET_PER_DISPLAY_UNIT[units?.system ?? "feet_inches"] ?? 1;
  return perUnit / feetPerDisplayUnit;
}
export function roofUvK(units?: UnitsRef): number {
  return 1 / (ROOF_REPEAT_FT * unitsPerFoot(units));
}
export function wallUvK(units?: UnitsRef): number {
  return 1 / (WALL_REPEAT_FT * unitsPerFoot(units));
}

// ---- Clay roof tiles (colour + bump) ---------------------------------------
// Bold Mangalore/pantile barrels: strong round-barrel shading across each
// column + a deep overlap shadow at the head of every course, so the pattern
// still reads as tiles from a distance (low contrast washes out to flat).
let _roof: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
export function roofTileMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (_roof) return _roof;
  const S = 512;
  const cols = 6; // barrels across one tile-repeat
  const rows = 8; // courses down one tile-repeat
  const [cc, cg] = makeCanvas(S);
  const [bc, bg] = makeCanvas(S);
  cg.fillStyle = "#a8461f";
  cg.fillRect(0, 0, S, S);
  bg.fillStyle = "#808080";
  bg.fillRect(0, 0, S, S);
  const cw = S / cols;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      // per-tile clay colour variation (visible tile-to-tile difference)
      const hue = 14 + ((r * 3 + c * 7) % 8) - 4;
      const lum = 40 + ((r * 5 + c * 11) % 16) - 6;
      // round barrel: bright crown, dark valleys at both edges
      const cg1 = cg.createLinearGradient(x, 0, x + cw, 0);
      cg1.addColorStop(0.0, `hsl(${hue}, 62%, ${lum - 16}%)`);
      cg1.addColorStop(0.5, `hsl(${hue}, 66%, ${lum + 10}%)`);
      cg1.addColorStop(1.0, `hsl(${hue}, 62%, ${lum - 16}%)`);
      cg.fillStyle = cg1;
      cg.fillRect(x, y, cw, rh);
      const bg1 = bg.createLinearGradient(x, 0, x + cw, 0);
      bg1.addColorStop(0.0, "#3a3a3a");
      bg1.addColorStop(0.5, "#f0f0f0");
      bg1.addColorStop(1.0, "#3a3a3a");
      bg.fillStyle = bg1;
      bg.fillRect(x, y, cw, rh);
    }
    // deep course-overlap shadow along the head of each row
    const sh = Math.max(4, rh * 0.16);
    cg.fillStyle = "rgba(0,0,0,0.42)";
    cg.fillRect(0, y, S, sh);
    bg.fillStyle = "#181818";
    bg.fillRect(0, y, S, sh);
  }
  _roof = { map: toTexture(cc, 1), bump: toTexture(bc, 1, false) };
  return _roof;
}

// ---- Laterite stone blocks (colour + bump) ---------------------------------
// Konkan laterite ("jambha") — warm reddish-ochre porous blocks laid in a
// running bond, with recessed mortar joints and the characteristic pitting.
let _laterite: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null = null;
export function lateriteMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  if (_laterite) return _laterite;
  const S = 512;
  const cols = 4; // blocks across one repeat
  const rows = 8; // courses down one repeat
  const [cc, cg] = makeCanvas(S);
  const [bc, bg] = makeCanvas(S);
  // Base = mortar (fills the joints the blocks don't cover).
  cg.fillStyle = "#8c7a66";
  cg.fillRect(0, 0, S, S);
  bg.fillStyle = "#4a4a4a"; // mortar sits recessed
  bg.fillRect(0, 0, S, S);
  const bw = S / cols;
  const bh = S / rows;
  const mortar = Math.max(3, bh * 0.14);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2); // running bond
    const y = r * bh;
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + off;
      const bx = x + mortar / 2;
      const by = y + mortar / 2;
      const bwi = bw - mortar;
      const bhi = bh - mortar;
      // per-block laterite colour variation (warm reddish-brown/ochre)
      const hue = 18 + ((r * 5 + c * 7) % 14) - 6;
      const lum = 33 + ((r * 7 + c * 13) % 16) - 5;
      cg.fillStyle = `hsl(${hue}, 46%, ${lum}%)`;
      cg.fillRect(bx, by, bwi, bhi);
      bg.fillStyle = "#c4c4c4"; // block face stands proud of the mortar
      bg.fillRect(bx, by, bwi, bhi);
      // pitting — the holes laterite is full of
      const pits = 30;
      for (let p = 0; p < pits; p++) {
        const px = bx + Math.random() * bwi;
        const py = by + Math.random() * bhi;
        const rr = 0.5 + Math.random() * 2.4;
        cg.fillStyle = `rgba(38,18,8,${0.12 + Math.random() * 0.32})`;
        cg.beginPath();
        cg.arc(px, py, rr, 0, Math.PI * 2);
        cg.fill();
        bg.fillStyle = "rgba(0,0,0,0.5)"; // pits are recessed
        bg.beginPath();
        bg.arc(px, py, rr, 0, Math.PI * 2);
        bg.fill();
      }
    }
  }
  _laterite = { map: toTexture(cc, 1), bump: toTexture(bc, 1, false) };
  return _laterite;
}

// ---- Grass / lawn (colour) --------------------------------------------------
let _grassCanvas: HTMLCanvasElement | null = null;
function buildGrass(): HTMLCanvasElement {
  const S = 512;
  const [c, g] = makeCanvas(S);
  g.fillStyle = "#5f7d3e";
  g.fillRect(0, 0, S, S);
  // Soft low-contrast mottle (keeps tiling seams from reading as a grid).
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rr = 24 + Math.random() * 70;
    g.fillStyle = `hsla(${90 + Math.random() * 20}, ${30 + Math.random() * 18}%, ${24 + Math.random() * 14}%, 0.10)`;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
  // Fine blade speckle for close-up texture.
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.fillStyle = `hsla(${84 + Math.random() * 30}, ${40 + Math.random() * 22}%, ${22 + Math.random() * 20}%, 0.6)`;
    g.fillRect(x, y, 1, 1 + Math.random() * 2);
  }
  return c;
}
export function grassTexture(repeat: number): THREE.CanvasTexture {
  if (!_grassCanvas) _grassCanvas = buildGrass();
  return toTexture(_grassCanvas, repeat);
}
