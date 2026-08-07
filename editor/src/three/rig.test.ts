import { describe, it, expect } from "vitest";
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Vector3, Euler, Quaternion } from "three";
import { arrayMatrices, applyRig, type RigOp } from "./rig";

// P1 (plans/declarative-plugins.md): the GLB node rig. Pure math + scene-graph, no GL.

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("rig — array matrices (linear / circular / spiral)", () => {
  it("linear array: translation accumulates per instance", () => {
    const m = arrayMatrices(3, { translate: [0, 0, 5] });
    const zs = m.map((mat) => new Vector3().setFromMatrixPosition(mat).z);
    expect(zs.map((z) => Math.round(z))).toEqual([0, 5, 10]);
  });

  it("spiral array: y rises linearly and yaw rotates per instance", () => {
    const m = arrayMatrices(3, { rotate: [0, 90, 0], translate: [0, 10, 0] });
    m.forEach((mat, i) => {
      const p = new Vector3(), q = new Quaternion(), s = new Vector3();
      mat.decompose(p, q, s);
      expect(Math.round(p.y)).toBe(i * 10); // lift per step
      const yaw = new Euler().setFromQuaternion(q, "YXZ").y * (180 / Math.PI);
      expect(near(((yaw % 360) + 360) % 360, (i * 90) % 360, 1e-3)).toBe(true);
    });
  });

  it("instance 0 is always the identity (the original node)", () => {
    const m = arrayMatrices(4, { translate: [1, 2, 3], rotate: [10, 20, 30] });
    expect(m[0].elements).toEqual(new Array(16).fill(0).map((_, i) => (i % 5 === 0 ? 1 : 0)));
  });
});

describe("rig — applyRig mutates named nodes", () => {
  const build = () => {
    const root = new Group();
    const mk = (name: string, pos: [number, number, number]) => {
      const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#ffffff" }));
      m.name = name;
      m.position.set(...pos);
      root.add(m);
      return m;
    };
    return { root, lid: mk("lid", [0, 0, 0]), ladder: mk("ladder", [0, 0, 0]), rung: mk("rung", [5, 0, 0]) };
  };

  it("translate / rotate / visible / material", () => {
    const { root, lid, ladder } = build();
    const ops: RigOp[] = [
      { op: "translate", node: "lid", by: [0, 1, 0] },
      { op: "rotate", node: "lid", by: [0, 90, 0] },
      { op: "visible", node: "ladder", value: 0 },
      { op: "material", node: "lid", color: "#ff0000" },
    ];
    const warns = applyRig(root, ops);
    expect(warns).toEqual([]);
    expect(lid.position.y).toBe(1);
    expect(near(lid.rotation.y, Math.PI / 2)).toBe(true);
    expect(ladder.visible).toBe(false);
    expect((lid.material as MeshStandardMaterial).color.getHexString()).toBe("ff0000");
  });

  it("array: clones the node count-1 times onto its parent", () => {
    const { root, rung } = build();
    const before = root.children.length;
    applyRig(root, [{ op: "array", node: "rung", count: 3, translate: [0, 2, 0] }]);
    expect(root.children.length).toBe(before + 2); // 2 clones added
    const rungs = root.children.filter((c) => c.name === "rung");
    const ys = rungs.map((r) => Math.round(r.position.y)).sort((a, b) => a - b);
    expect(ys).toEqual([0, 2, 4]); // base + 2 lifted clones (base rung stays at y=0)
    expect(rungs.every((r) => Math.round(r.position.x) === 5)).toBe(true); // radius preserved
    void rung;
  });

  it("a rig op naming a missing node is skipped with a warning (never blanks the model)", () => {
    const { root } = build();
    const warns = applyRig(root, [{ op: "translate", node: "nope", by: [1, 1, 1] }]);
    expect(warns.length).toBe(1);
    expect(warns[0]).toMatch(/not found/);
  });
});
