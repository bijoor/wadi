import { describe, expect, it } from "vitest";
import type { LayerDef } from "./layers";
import {
  UNGROUPED,
  fromGroups,
  groupNameOf,
  moveGroup,
  moveLayerInGroup,
  moveLayerToGroup,
  renameGroup,
  toGroups,
} from "./layerGrouping";

const L = (id: string, group?: string): LayerDef => ({ id, label: id, color: "#888", group });

// Ground (a,b) then Loft (c) then a bare/ungrouped (d).
const base: LayerDef[] = [L("a", "Ground"), L("b", "Ground"), L("c", "Loft"), L("d")];

const ids = (ls: LayerDef[]) => ls.map((l) => l.id).join(",");
const groupsOf = (ls: LayerDef[]) => toGroups(ls).map((g) => `${g.name}[${ids(g.layers)}]`).join(" ");

describe("layerGrouping", () => {
  it("groupNameOf treats blank as Ungrouped", () => {
    expect(groupNameOf(L("x"))).toBe(UNGROUPED);
    expect(groupNameOf(L("x", "  "))).toBe(UNGROUPED);
    expect(groupNameOf(L("x", "Site"))).toBe("Site");
  });

  it("toGroups buckets in first-appearance order", () => {
    expect(groupsOf(base)).toBe("Ground[a,b] Loft[c] Ungrouped[d]");
  });

  it("fromGroups round-trips and normalizes Ungrouped → undefined", () => {
    const back = fromGroups(toGroups(base));
    expect(ids(back)).toBe("a,b,c,d");
    expect(back.find((l) => l.id === "d")!.group).toBeUndefined();
  });

  it("moveGroup swaps whole blocks", () => {
    expect(groupsOf(moveGroup(base, "Loft", -1))).toBe("Loft[c] Ground[a,b] Ungrouped[d]");
    expect(groupsOf(moveGroup(base, "Ground", 1))).toBe("Loft[c] Ground[a,b] Ungrouped[d]");
  });

  it("moveGroup is a no-op at the edges", () => {
    expect(ids(moveGroup(base, "Ground", -1))).toBe(ids(base));
    expect(ids(moveGroup(base, "Ungrouped", 1))).toBe(ids(base));
  });

  it("moveLayerInGroup reorders within the group only", () => {
    expect(groupsOf(moveLayerInGroup(base, "b", -1))).toBe("Ground[b,a] Loft[c] Ungrouped[d]");
    // 'a' is already first in Ground → no-op
    expect(ids(moveLayerInGroup(base, "a", -1))).toBe(ids(base));
  });

  it("moveLayerToGroup moves + drops empty source groups", () => {
    expect(groupsOf(moveLayerToGroup(base, "c", "Ground"))).toBe("Ground[a,b,c] Ungrouped[d]");
    const moved = moveLayerToGroup(base, "c", "Ground");
    expect(moved.find((l) => l.id === "c")!.group).toBe("Ground");
  });

  it("moveLayerToGroup can create a new group", () => {
    expect(groupsOf(moveLayerToGroup(base, "d", "Roof deck"))).toBe(
      "Ground[a,b] Loft[c] Roof deck[d]",
    );
  });

  it("renameGroup relabels every layer in the group", () => {
    const r = renameGroup(base, "Ground", "Ground Floor");
    expect(groupsOf(r)).toBe("Ground Floor[a,b] Loft[c] Ungrouped[d]");
    expect(r.filter((l) => l.group === "Ground Floor").map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("renameGroup into an existing name MERGES", () => {
    expect(groupsOf(renameGroup(base, "Loft", "Ground"))).toBe("Ground[a,b,c] Ungrouped[d]");
  });

  it("renameGroup is a no-op for blank / unchanged / missing", () => {
    expect(ids(renameGroup(base, "Ground", "  "))).toBe(ids(base));
    expect(ids(renameGroup(base, "Ground", "Ground"))).toBe(ids(base));
    expect(ids(renameGroup(base, "Nope", "X"))).toBe(ids(base));
  });
});
