import type { HouseObject } from "../schema/houseConfig";

// Ensure a new object's name doesn't collide with anything already on the floor.
// Appends _1, _2, … until free. Shared by defaultFactory + registry node defaults.
export function uniqueName(existing: HouseObject[], base: string): string {
  const taken = new Set<string>();
  for (const o of existing) {
    const n = (o as { name?: unknown }).name;
    if (typeof n === "string") taken.add(n);
  }
  let i = 1;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
