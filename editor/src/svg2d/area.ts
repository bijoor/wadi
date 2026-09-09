// Built-up area of a floor: the sum of its room footprints (width × length), in
// project units². Rooms only — not slabs, beams, or pillars — so it is the covered
// room area of the floor. formatArea() (format.ts) converts it to the display units.

type FloorLike = { objects?: Array<Record<string, unknown>> };

export function floorBuiltUpAreaUnits(floor: FloorLike): number {
  let area = 0;
  for (const obj of floor.objects ?? []) {
    if (obj.type === "room") {
      area += (Number(obj.width) || 0) * (Number(obj.length) || 0);
    }
  }
  return area;
}
