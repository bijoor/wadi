// Legacy object-type migrations that run on load, regardless of `wadi_version`
// (distinct from migrateVersion.ts, which is version-semantic). Retired primitives are
// rewritten into their modern equivalents so old configs keep loading + rendering.
//
//   kitchen_platform -> counter(s): the old polyline "platform" (a path + side + depth
//   + height, extruded one box per segment) becomes one `counter` run per segment. The
//   counter's free form (absolute x/y + rotation + length) reproduces the exact geometry:
//   the box centre sits at the segment midpoint pushed out by depth/2 on the chosen side,
//   length runs along the segment, depth projects into the room. See
//   plans/parametric-furniture-elements.md (P4).

type Bag = Record<string, unknown>;

const COPY_FIELDS = ["base_z", "material", "layer", "z_offset", "locked", "enabled"] as const;

// Convert one legacy kitchen_platform object into an array of `counter` objects (one per
// polyline segment). Pure geometry; no I/O.
export function kitchenPlatformToCounters(kp: Bag): Bag[] {
  const path = Array.isArray(kp.path) ? (kp.path as [number, number][]) : [];
  const side = kp.side === "left" ? "left" : "right";
  const depth = Number(kp.depth) || 0;
  const height = Number(kp.height) || 0;
  const out: Bag[] = [];
  const multi = path.length > 2; // suffix names only when a platform splits into >1 run
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen, uy = dy / segLen;
    // Perpendicular the platform extends along: left = +90° CCW of the segment, right = -90°.
    const perpX = side === "left" ? -uy : uy;
    const perpY = side === "left" ? ux : -ux;
    const cx = (a[0] + b[0]) / 2 + perpX * (depth / 2);
    const cy = (a[1] + b[1]) / 2 + perpY * (depth / 2);
    // Plan yaw so the run's length lies along the segment; symmetric box, so 90≡270.
    const rot = ((Math.round((Math.atan2(uy, ux) * 180) / Math.PI) % 360) + 360) % 360;
    const c: Bag = { type: "counter", x: round(cx), y: round(cy), length: round(segLen), depth, height };
    if (rot) c.rotation = rot; // omit 0 (the default facing)
    if (typeof kp.name === "string") c.name = multi ? `${kp.name}_${i + 1}` : kp.name;
    for (const f of COPY_FIELDS) if (kp[f] !== undefined) c[f] = kp[f];
    out.push(c);
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Walk a config's floors and replace every retired-type object in place. Returns whether
// anything changed. Mutates `config` (call on a fresh parse before schema validation).
export function migrateLegacyTypes(config: Bag): boolean {
  let changed = false;
  const floors = Array.isArray(config.floors) ? (config.floors as Bag[]) : [];
  for (const fl of floors) {
    const objs = Array.isArray(fl.objects) ? (fl.objects as Bag[]) : [];
    if (!objs.some((o) => o.type === "kitchen_platform")) continue;
    const next: Bag[] = [];
    for (const o of objs) {
      if (o.type === "kitchen_platform") {
        next.push(...kitchenPlatformToCounters(o));
        changed = true;
      } else {
        next.push(o);
      }
    }
    fl.objects = next;
  }
  return changed;
}
