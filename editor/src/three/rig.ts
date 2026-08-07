// GLB node rig (plans/declarative-plugins.md P1): manipulate a loaded GLB by its
// NAMED nodes, driven by a `model` object's `rig` ops. This is the one genuinely new
// 3D capability. It uses three's MATH + scene-graph classes only (Matrix4, Object3D,
// getObjectByName) — no WebGL — so it is unit-testable and runs anywhere three loads.
//
// A rig interpolates and arranges the geometry the GLB already contains: move/rotate/
// scale a part, show/hide it, recolour it, or ARRAY it with a per-instance transform
// delta (linear, circular about a pivot, or spiral). It never adds vertices or cuts
// holes; that stays code-plugin / CSG territory.

import { Matrix4, Vector3, Euler, Quaternion, MathUtils, Mesh, MeshStandardMaterial } from "three";
import type { Object3D } from "three";

export type Vec3 = [number, number, number];

// The rig ops, mirroring the `rigOp` zod schema in schema/houseConfig.ts. Values are in
// the GLB's own space: translate/scale are factors/offsets on the node, rotate is Euler
// degrees, `about` is a pivot point (GLB coords).
export type RigOp =
  | { op: "translate"; node: string; by: Vec3 }
  | { op: "rotate"; node: string; by: Vec3 } // Euler degrees
  | { op: "scale"; node: string; by: Vec3 }
  | { op: "visible"; node: string; value: boolean | number }
  | { op: "material"; node: string; color: string }
  | {
      op: "array";
      node: string;
      count: number;
      translate?: Vec3;
      rotate?: Vec3; // Euler degrees, per instance
      scale?: Vec3;
      about?: Vec3; // pivot for the rotation (so circular / spiral)
    };

const isEnabled = (v: boolean | number): boolean => v !== false && v !== 0;

/** The single-step transform A for an array: A = T(about) · R(rotate) · T(-about) ·
 *  T(translate) · S(scale). Instance i's placement is A applied i times (A^i). Pure. */
export function stepMatrix(step: {
  translate?: Vec3;
  rotate?: Vec3;
  scale?: Vec3;
  about?: Vec3;
}): Matrix4 {
  const A = new Matrix4();
  const [ax, ay, az] = step.about ?? [0, 0, 0];
  const rot = step.rotate
    ? new Matrix4().makeRotationFromEuler(
        new Euler(
          MathUtils.degToRad(step.rotate[0]),
          MathUtils.degToRad(step.rotate[1]),
          MathUtils.degToRad(step.rotate[2]),
        ),
      )
    : new Matrix4();
  // rotate about the pivot: T(about) · R · T(-about)
  const aboutRot = new Matrix4()
    .makeTranslation(ax, ay, az)
    .multiply(rot)
    .multiply(new Matrix4().makeTranslation(-ax, -ay, -az));
  const trans = step.translate
    ? new Matrix4().makeTranslation(step.translate[0], step.translate[1], step.translate[2])
    : new Matrix4();
  const scl = step.scale ? new Matrix4().makeScale(step.scale[0], step.scale[1], step.scale[2]) : new Matrix4();
  return A.copy(aboutRot).multiply(trans).multiply(scl);
}

/** The per-instance matrices for an array of `count`: [I, A, A², …, A^(count-1)]. Pure
 *  and unit-testable (no scene graph). */
export function arrayMatrices(
  count: number,
  step: { translate?: Vec3; rotate?: Vec3; scale?: Vec3; about?: Vec3 },
): Matrix4[] {
  const A = stepMatrix(step);
  const out: Matrix4[] = [new Matrix4()]; // instance 0 = identity (the original node)
  for (let i = 1; i < Math.max(1, Math.floor(count)); i++) {
    out.push(out[i - 1].clone().multiply(A));
  }
  return out;
}

function setMaterialColor(node: Object3D, color: string): void {
  node.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    // Clone the material so we don't mutate one shared across instances / assets.
    const mat = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material?.clone();
    if (!mat) return;
    const apply = (m: unknown) => {
      const sm = m as MeshStandardMaterial;
      if (sm.color) sm.color.set(color);
    };
    if (Array.isArray(mat)) mat.forEach(apply);
    else apply(mat);
    mesh.material = mat;
  });
}

/** Apply a list of rig ops to a cloned GLB scene root, in order. Mutates `root`. A node
 *  named in an op that isn't found is skipped with a warning (a rig authored against a
 *  different asset shouldn't blank the model). Returns the warnings. */
export function applyRig(root: Object3D, ops: readonly RigOp[] | undefined): string[] {
  const warnings: string[] = [];
  for (const op of ops ?? []) {
    const node = root.getObjectByName(op.node);
    if (!node) {
      warnings.push(`rig: node "${op.node}" not found in the model`);
      continue;
    }
    switch (op.op) {
      case "translate":
        node.position.add(new Vector3(...op.by));
        break;
      case "rotate":
        node.rotation.set(
          node.rotation.x + MathUtils.degToRad(op.by[0]),
          node.rotation.y + MathUtils.degToRad(op.by[1]),
          node.rotation.z + MathUtils.degToRad(op.by[2]),
        );
        break;
      case "scale":
        node.scale.multiply(new Vector3(...op.by));
        break;
      case "visible":
        node.visible = isEnabled(op.value);
        break;
      case "material":
        setMaterialColor(node, op.color);
        break;
      case "array": {
        const parent = node.parent;
        if (!parent) {
          warnings.push(`rig: array node "${op.node}" has no parent`);
          break;
        }
        // the node's own local transform (composed directly, not node.matrix, which
        // isn't auto-updated outside a render loop)
        const base = new Matrix4().compose(node.position, node.quaternion, node.scale);
        const mats = arrayMatrices(op.count, op);
        for (let i = 1; i < mats.length; i++) {
          const clone = node.clone(true);
          // instance i = A^i · base (apply the step recurrence on top of the node's transform)
          const m = mats[i].clone().multiply(base);
          const p = new Vector3(), q = new Quaternion(), s = new Vector3();
          m.decompose(p, q, s);
          clone.position.copy(p);
          clone.quaternion.copy(q);
          clone.scale.copy(s);
          parent.add(clone);
        }
        break;
      }
    }
  }
  return warnings;
}
