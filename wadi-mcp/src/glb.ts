// Pure GLB (binary glTF) inspector — no three.js, no DOM. Reads the JSON chunk
// of a .glb and reports the named nodes/meshes/materials an author can target in
// a `model { … }` rig block (translate/rotate/scale/visible/material "nodeName").
//
// GLB layout: 12-byte header (magic "glTF", version, total length) followed by
// chunks — each `[uint32 length][uint32 type][bytes]`. The first chunk (type
// 0x4E4F534A = "JSON") holds the glTF JSON; that is all we need for names.

export interface GlbNodeInfo {
  index: number;
  name: string;
  children: number[];
  mesh?: string; // resolved mesh name if the node references one
}

export interface GlbInspection {
  nodeCount: number;
  nodes: GlbNodeInfo[]; // only nodes that carry a name (rig targets by name)
  unnamedNodeCount: number;
  meshes: string[];
  materials: string[];
  roots: number[]; // scene root node indices
}

const GLB_MAGIC = 0x46546c67; // "glTF" little-endian
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/** Extract the glTF JSON object from a .glb byte buffer. Throws on a malformed
 *  container so the caller can report a clear error. */
export function glbJson(bytes: Uint8Array): Record<string, unknown> {
  if (bytes.byteLength < 12) throw new Error("Not a GLB: file shorter than the 12-byte header.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('Not a GLB: missing "glTF" magic (a .gltf JSON file is not supported — export .glb).');
  // header: [0]=magic [4]=version [8]=length ; chunks start at 12
  let off = 12;
  while (off + 8 <= bytes.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === JSON_CHUNK) {
      const slice = bytes.subarray(start, start + len);
      const text = new TextDecoder("utf-8").decode(slice);
      return JSON.parse(text) as Record<string, unknown>;
    }
    off = start + len;
  }
  throw new Error("GLB has no JSON chunk.");
}

/** Inspect a GLB buffer and list its named nodes/meshes/materials. */
export function inspectGlb(bytes: Uint8Array): GlbInspection {
  const gltf = glbJson(bytes);
  const rawNodes = (Array.isArray(gltf.nodes) ? gltf.nodes : []) as Array<Record<string, unknown>>;
  const rawMeshes = (Array.isArray(gltf.meshes) ? gltf.meshes : []) as Array<Record<string, unknown>>;
  const rawMats = (Array.isArray(gltf.materials) ? gltf.materials : []) as Array<Record<string, unknown>>;
  const scenes = (Array.isArray(gltf.scenes) ? gltf.scenes : []) as Array<Record<string, unknown>>;

  const meshName = (i: number): string | undefined => {
    const m = rawMeshes[i];
    return m && typeof m.name === "string" ? m.name : undefined;
  };

  const named: GlbNodeInfo[] = [];
  let unnamed = 0;
  rawNodes.forEach((n, index) => {
    const name = typeof n.name === "string" ? n.name : "";
    if (!name) {
      unnamed++;
      return;
    }
    const children = Array.isArray(n.children) ? (n.children as number[]) : [];
    const info: GlbNodeInfo = { index, name, children };
    if (typeof n.mesh === "number") {
      const mn = meshName(n.mesh);
      if (mn) info.mesh = mn;
    }
    named.push(info);
  });

  const meshes = rawMeshes.map((m) => (typeof m.name === "string" ? m.name : "")).filter(Boolean);
  const materials = rawMats.map((m) => (typeof m.name === "string" ? m.name : "")).filter(Boolean);
  const activeScene = typeof gltf.scene === "number" ? gltf.scene : 0;
  const roots = (scenes[activeScene]?.nodes as number[] | undefined) ?? [];

  return {
    nodeCount: rawNodes.length,
    nodes: named,
    unnamedNodeCount: unnamed,
    meshes,
    materials,
    roots,
  };
}
