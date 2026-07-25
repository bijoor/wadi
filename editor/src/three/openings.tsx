// Window and door fills for wall openings. The wall CSG leaves a clean hole;
// this drops a framed, glazed window (or a slab door) into it so the house
// reads as built rather than a shell.
//
// Placement: House3D passes the opening's CENTRE in three-space (cx,cy,cz), the
// wall's Y-rotation (rotY), the opening size (width×height, project units) and
// the wall thickness (wallDepth). We build everything in the opening's LOCAL
// frame — X along the wall (width), Y up (height), Z through the wall
// (thickness) — matching how the wall itself is built, then rotate by rotY.

const FRAME_COLOR = "#6b4a2e"; // timber frame / sash
const SILL_COLOR = "#9a938a"; // cast sill under windows
const DOOR_COLOR = "#5c3d22"; // door leaf (darker timber)
const HANDLE_COLOR = "#b08d57"; // brass
const GLASS_COLOR = "#aecbd9";

interface Props {
  cx: number;
  cy: number;
  cz: number;
  width: number;
  height: number;
  rotY: number;
  kind: "door" | "window";
  wallDepth?: number;
}

export function OpeningPane({
  cx, cy, cz, width, height, rotY, kind, wallDepth = 8,
}: Props) {
  // Frame member width scales with the opening so it reads right at any unit
  // scale (feet or metric); frame depth sits within the wall thickness.
  const fw = Math.max(1.2, Math.min(width, height) * 0.06);
  const fd = Math.max(2, wallDepth * 0.8);
  const innerW = Math.max(0.1, width - 2 * fw);
  const innerH = Math.max(0.1, height - 2 * fw);

  return (
    <group position={[cx, cy, cz]} rotation={[0, rotY, 0]}>
      {/* --- frame: head, jambs, and sill/threshold --- */}
      <mesh position={[0, height / 2 - fw / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, fw, fd]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[-width / 2 + fw / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[fw, height, fd]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[width / 2 - fw / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[fw, height, fd]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0, -height / 2 + fw / 2, 0]} castShadow receiveShadow>
        <boxGeometry
          args={[
            width + (kind === "window" ? fw * 1.5 : 0),
            fw,
            fd * (kind === "window" ? 1.5 : 1),
          ]}
        />
        <meshStandardMaterial
          color={kind === "window" ? SILL_COLOR : FRAME_COLOR}
          roughness={0.85}
          metalness={0}
        />
      </mesh>

      {kind === "window" ? (
        <>
          {/* glazing — light, low-roughness, transparent so it reflects the
              sky and shows the interior faintly behind it */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[innerW, innerH, Math.max(0.3, fd * 0.12)]} />
            <meshStandardMaterial
              color={GLASS_COLOR}
              transparent
              opacity={0.3}
              roughness={0.06}
              metalness={0}
              envMapIntensity={1.6}
            />
          </mesh>
          {/* mullions — split into panes once the sash is big enough */}
          {innerW > 12 && (
            <mesh position={[0, 0, fd * 0.06]} castShadow>
              <boxGeometry args={[fw * 0.6, innerH, fd * 0.5]} />
              <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} metalness={0} />
            </mesh>
          )}
          {innerH > 12 && (
            <mesh position={[0, 0, fd * 0.06]} castShadow>
              <boxGeometry args={[innerW, fw * 0.6, fd * 0.5]} />
              <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} metalness={0} />
            </mesh>
          )}
        </>
      ) : (
        <>
          {/* door leaf — fills the opening below the head frame */}
          <mesh position={[0, -fw * 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[innerW, height - fw, fd * 0.55]} />
            <meshStandardMaterial color={DOOR_COLOR} roughness={0.6} metalness={0} />
          </mesh>
          {/* handle */}
          <mesh position={[innerW / 2 - fw * 1.2, 0, fd * 0.35]} castShadow>
            <boxGeometry args={[fw * 0.5, fw, fw * 0.5]} />
            <meshStandardMaterial color={HANDLE_COLOR} roughness={0.3} metalness={0.8} />
          </mesh>
        </>
      )}
    </group>
  );
}
