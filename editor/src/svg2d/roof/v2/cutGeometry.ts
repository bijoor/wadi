// Fabrication cut geometry for a v2 roof frame.
//
// Steel roof members are set ON EDGE and welded end-to-side: each rafter's top
// butts flush against the vertical side face of the ridge or hip it lands on,
// and each hip's top butts flush against the ridge's side face. This module
// computes, for each distinct end cut, the compound angles (bevel + mitre) and
// a wrap-around template (the back-set distance from a square line at the long
// toe, at each of the four corners A/B/C/D). The panels in cutPanel.ts draw it.
//
// Conventions (matches V2RoofSolid on-edge orientation):
//   local frame: f = axis toward the top (welded) end, up = in-plane up
//                (worldUp projected ⟂ f), right = f × up (horizontal).
//   on edge: the LARGER section dim is vertical (±up), the smaller horizontal.
//   corners: A = up/−side, B = up/+side, C = dn/+side, D = dn/−side.

import type { Point3D, RoofSpec, StraightMember } from "./model";
import type { FramingConfig } from "./bom";

const sub = (a: Point3D, b: Point3D): Point3D => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Point3D, b: Point3D): Point3D => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Point3D, s: number): Point3D => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (v: Point3D) => Math.hypot(v[0], v[1], v[2]);
const unit = (v: Point3D): Point3D => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const deg = (r: number) => (r * 180) / Math.PI;

export interface LocalFrame { low: Point3D; top: Point3D; f: Point3D; up: Point3D; right: Point3D; }

// Orient a member so `f` points to the higher (welded) end.
export function localFrame(m: StraightMember): LocalFrame {
  let low = m.start, top = m.end;
  if (low[2] > top[2]) { const t = low; low = top; top = t; }
  const f = unit(sub(top, low));
  const up = unit(sub([0, 0, 1], mul(f, dot([0, 0, 1], f))));
  const right = unit(cross(f, up));
  return { low, top, f, up, right };
}

export interface CutAngles { bevel: number; mitre: number; rel: Record<"A" | "B" | "C" | "D", number>; }

// Solve the flush end cut: the plane through Q with normal n cuts the tube
// (section [w,d] inches, on edge). Returns bevel/mitre and the per-corner
// set-back distances (inches) from a square line at the long toe.
function solve(rf: LocalFrame, sec: [number, number], Q: Point3D, n: Point3D, inPerUnit: number): CutAngles {
  const V = (Math.max(sec[0], sec[1]) / 2) * inPerUnit; // half the vertical (larger) dim
  const H = (Math.min(sec[0], sec[1]) / 2) * inPerUnit; // half the horizontal (smaller) dim
  const nH = unit(n);
  const nu = dot(nH, rf.f) || 1e-6;
  const corners: Record<string, [number, number]> = { A: [+1, -1], B: [+1, +1], C: [-1, +1], D: [-1, -1] };
  const s: Record<string, number> = {};
  for (const [k, [sv, sw]] of Object.entries(corners)) {
    const P = add(rf.top, add(mul(rf.up, sv * V), mul(rf.right, sw * H)));
    s[k] = dot(sub(P, Q), nH) / nu; // signed distance back from top along axis
  }
  const smin = Math.min(s.A, s.B, s.C, s.D);
  const toIn = 1 / inPerUnit;
  const rel = {
    A: (s.A - smin) * toIn, B: (s.B - smin) * toIn,
    C: (s.C - smin) * toIn, D: (s.D - smin) * toIn,
  };
  let mitre = Math.abs(deg(Math.atan2(dot(nH, rf.right), nu))); if (mitre > 90) mitre = 180 - mitre;
  let bevel = Math.abs(deg(Math.atan2(dot(nH, rf.up), nu))); if (bevel > 90) bevel = 180 - bevel;
  return { bevel, mitre, rel };
}

function nearestOnLine(P: Point3D, A: Point3D, B: Point3D): Point3D {
  const d = unit(sub(B, A));
  return add(A, mul(d, dot(sub(P, A), d)));
}
const distLine = (P: Point3D, A: Point3D, B: Point3D) => len(sub(P, nearestOnLine(P, A, B)));

// Horizontal unit normal to a member's axis (perpendicular to it in plan).
function horizNormal(m: StraightMember): Point3D {
  const d = unit([m.end[0] - m.start[0], m.end[1] - m.start[1], 0]);
  return unit(cross(d, [0, 0, 1])); // horizontal, ⟂ to the member in plan
}

const sectionInches = (s?: [number, number], d: [number, number] = [2, 4]): [number, number] => s ?? d;

export interface HipCut {
  key: string; label: string; bevel: number; mitre: number;
  rel: Record<"A" | "B" | "C" | "D", number>; slope: number; lengthUnits: number; count: number;
  // Same-section hip on a horizontal ridge: the oblique cut face is taller than
  // the section, so aligned bottoms leave the top toe-corner proud of the ridge.
  faceHeightIn?: number; overshootIn?: number; topCorner?: "A" | "B" | "C" | "D";
}

// For a hip welded to a same-section horizontal ridge with bottoms aligned:
// the cut-face height, how far the top corner overshoots the ridge top, and
// which corner it is. Derived from the cut's rel + slope + section.
export function hipOvershoot(
  rel: Record<"A" | "B" | "C" | "D", number>, slopeDeg: number, sec: [number, number], inPerUnit: number,
): { faceHeightIn: number; overshootIn: number; topCorner: "A" | "B" | "C" | "D" } {
  const slope = (slopeDeg * Math.PI) / 180;
  const V = (Math.max(sec[0], sec[1]) / 2) * inPerUnit;
  const cosS = Math.cos(slope), sinS = Math.sin(slope);
  const sv: Record<string, number> = { A: 1, B: 1, C: -1, D: -1 };
  const z: Record<string, number> = {};
  (["A", "B", "C", "D"] as const).forEach((k) => { z[k] = cosS * sv[k] * V - sinS * (rel[k] * inPerUnit); });
  const topCorner = (["A", "B", "C", "D"] as const).reduce((m, k) => (z[k] > z[m] ? k : m), "A");
  const faceHeightIn = (Math.max(z.A, z.B, z.C, z.D) - Math.min(z.A, z.B, z.C, z.D)) / inPerUnit;
  const sectionV = Math.max(sec[0], sec[1]);
  return { faceHeightIn, overshootIn: faceHeightIn - sectionV, topCorner };
}

// One cut per distinct hip end (deduped: mirror-handed hips share a cut).
export function computeHipCuts(spec: RoofSpec, framing: FramingConfig, inPerUnit: number): HipCut[] {
  const ridge = spec.members.find((m) => m.role === "ridge");
  const hips = spec.members.filter((m) => m.role === "hip");
  if (!ridge || hips.length === 0) return [];
  const ridgeSec = sectionInches(framing.ridge_size_in, [6, 3]);
  const halfRidge = (Math.min(ridgeSec[0], ridgeSec[1]) / 2) * inPerUnit; // to the vertical side face
  const nRidge = horizNormal(ridge);
  const hipSec = sectionInches(framing.hip_size_in ?? framing.ridge_size_in, [6, 3]);
  const rMid: Point3D = [(ridge.start[0] + ridge.end[0]) / 2, (ridge.start[1] + ridge.end[1]) / 2, ridge.start[2]];

  const raw = hips.map((h) => {
    const rf = localFrame(h);
    // which side of the ridge line the hip sits on
    const side = Math.sign(dot(sub(rf.low, rMid), nRidge)) || 1;
    const Q = add(rf.top, mul(nRidge, side * halfRidge));
    const a = solve(rf, hipSec, Q, nRidge, inPerUnit);
    return { a, slope: deg(Math.asin(rf.f[2])), lengthUnits: len(sub(rf.top, rf.low)) };
  });
  return dedupeIndexed(raw, "Hip → central ridge").cuts.map((c, i) => ({
    ...c, key: `hip${i}`, ...hipOvershoot(c.rel, c.slope, ridgeSec, inPerUnit),
  }));
}

export interface RafterCut extends HipCut { color: string; groupIndex: number; }
export interface RafterCutResult { cuts: RafterCut[]; groupOfRafterId: Map<string, number>; }

const CUT_COLORS = ["#b45309", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#c026d3"];

// Classify each rafter by (its plane, the spine it welds to) and compute one
// cut per group; dedupe identical (mirror-handed) groups. Also returns which
// deduped group each rafter (by member id) belongs to, for the key plan.
export function computeRafterCuts(spec: RoofSpec, framing: FramingConfig, inPerUnit: number): RafterCutResult {
  const ridge = spec.members.find((m) => m.role === "ridge");
  const hips = spec.members.filter((m) => m.role === "hip");
  const rafters = spec.members.filter((m) => m.role === "rafter");
  if (rafters.length === 0) return { cuts: [], groupOfRafterId: new Map() };
  const rafterSec = sectionInches(framing.rafter_size_in, [2, 4]);
  const ridgeSec = sectionInches(framing.ridge_size_in, [6, 3]);
  const hipSec = sectionInches(framing.hip_size_in ?? framing.ridge_size_in, [6, 3]);
  const halfRidge = (Math.min(ridgeSec[0], ridgeSec[1]) / 2) * inPerUnit;
  const halfHip = (Math.min(hipSec[0], hipSec[1]) / 2) * inPerUnit;
  const nRidge = ridge ? horizNormal(ridge) : null;
  const rMid: Point3D | null = ridge
    ? [(ridge.start[0] + ridge.end[0]) / 2, (ridge.start[1] + ridge.end[1]) / 2, ridge.start[2]]
    : null;

  // group rafters by (plane, target spine)
  type Group = { key: string; rf: LocalFrame[]; ids: string[]; targetKind: "ridge" | "hip"; targetIdx: number; plane: string; roleTri: boolean };
  const groups = new Map<string, Group>();
  for (const r of rafters) {
    const rf = localFrame(r);
    let best = Infinity, kind: "ridge" | "hip" = "ridge", idx = -1;
    if (ridge) { const d = distLine(rf.top, ridge.start, ridge.end); if (d < best) { best = d; kind = "ridge"; idx = -1; } }
    hips.forEach((h, i) => { const d = distLine(rf.top, h.start, h.end); if (d < best) { best = d; kind = "hip"; idx = i; } });
    if (kind === "ridge" && !ridge) continue;
    const plane = (r.source_plane_id as string) || "";
    const key = `${plane}|${kind}${idx}`;
    const g = groups.get(key) ?? { key, rf: [], ids: [], targetKind: kind, targetIdx: idx, plane, roleTri: plane.includes("hip_face") };
    g.rf.push(rf); g.ids.push(r.id); groups.set(key, g);
  }

  const rawGroups = [...groups.values()];
  const raw = rawGroups.map((g) => {
    const rf = g.rf[Math.floor(g.rf.length / 2)];
    let Q: Point3D, n: Point3D;
    if (g.targetKind === "ridge" && ridge && nRidge && rMid) {
      const side = Math.sign(dot(sub(rf.top, rMid), nRidge)) || 1;
      Q = add(rf.top, mul(nRidge, side * halfRidge)); n = nRidge;
    } else {
      const h = hips[g.targetIdx];
      const hf = localFrame(h);
      const rN = hf.right; // horizontal ⟂ to the hip
      const side = Math.sign(dot(sub(rf.low, rf.top), rN)) || 1;
      Q = add(rf.top, mul(rN, side * halfHip)); n = rN;
    }
    const a = solve(rf, rafterSec, Q, n, inPerUnit);
    const label = g.targetKind === "ridge"
      ? "Common rafters → central ridge"
      : `Jack rafters → hip ${g.roleTri ? "(end face)" : "(long face)"}`;
    return { a, slope: deg(Math.asin(rf.f[2])), lengthUnits: len(sub(rf.top, rf.low)), count: g.rf.length, label };
  });
  const { cuts: deduped, indexOfRaw } = dedupeIndexed(raw);
  const cuts: RafterCut[] = deduped.map((c, i) => ({ ...c, key: `raf${i}`, color: CUT_COLORS[i % CUT_COLORS.length], groupIndex: i }));
  const groupOfRafterId = new Map<string, number>();
  rawGroups.forEach((g, gi) => { const fin = indexOfRaw[gi]; for (const id of g.ids) groupOfRafterId.set(id, fin); });
  return { cuts, groupOfRafterId };
}

// Merge cuts whose bevel/mitre and (unordered) corner set-backs match — these
// are the same physical cut, just handed. Keeps the first label, sums counts.
// Returns the merged cuts and, for each input, the index of the cut it fell in.
function dedupeIndexed<T extends { a: CutAngles; slope: number; lengthUnits: number; count?: number; label?: string }>(
  raw: T[], fallbackLabel = "",
): { cuts: HipCut[]; indexOfRaw: number[] } {
  const out: Array<HipCut & { sig: string }> = [];
  const indexOfRaw: number[] = [];
  for (const r of raw) {
    const sortedRel = [r.a.rel.A, r.a.rel.B, r.a.rel.C, r.a.rel.D].map((v) => v.toFixed(2)).sort().join(",");
    const sig = `${r.a.bevel.toFixed(1)}|${r.a.mitre.toFixed(1)}|${sortedRel}`;
    const at = out.findIndex((o) => o.sig === sig);
    if (at >= 0) { out[at].count += r.count ?? 1; indexOfRaw.push(at); continue; }
    indexOfRaw.push(out.length);
    out.push({
      sig, key: "", label: r.label ?? fallbackLabel,
      bevel: r.a.bevel, mitre: r.a.mitre, rel: r.a.rel,
      slope: r.slope, lengthUnits: r.lengthUnits, count: r.count ?? 1,
    });
  }
  const cuts = out.map((c) => { const { sig, ...rest } = c; void sig; return rest; });
  return { cuts, indexOfRaw };
}
