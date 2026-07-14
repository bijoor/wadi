// Shared framing-config section used by both HipRoofForm and
// GableRoofForm. Exposes the frame member sizes + on-centre spacings
// that RoofFrameMesh / GableRoofFrameMesh read from
// `roof.framing.*`, with hints showing the current fallback default
// from DEFAULT_GLOBAL_CONFIG.roof_framing.

import { NumberField, Section } from "./fields";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

type Bag = Record<string, unknown>;

function getFraming(bag: Bag): Bag {
  return (bag.framing as Bag | undefined) ?? {};
}

// Immutable setter for a size-in array (2-tuple). Passing undefined
// removes the field so the fallback default kicks in again.
function makeSizeSetter(
  bag: Bag,
  setAt: (path: string[], value: unknown) => void,
  key: string,
  fallback: [number, number],
) {
  const cur = (getFraming(bag)[key] as [number, number] | undefined) ?? fallback;
  return {
    w: cur[0],
    d: cur[1],
    setW: (v: number | undefined) => {
      if (v === undefined) setAt(["framing", key], undefined);
      else setAt(["framing", key], [v, cur[1]]);
    },
    setD: (v: number | undefined) => {
      if (v === undefined) setAt(["framing", key], undefined);
      else setAt(["framing", key], [cur[0], v]);
    },
  };
}

export function FramingSection({
  bag,
  setAt,
}: {
  bag: Bag;
  setAt: (path: string[], value: unknown) => void;
}) {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const framing = getFraming(bag);
  const rafter = makeSizeSetter(bag, setAt, "rafter_size_in", g.rafter_size_in);
  const purlin = makeSizeSetter(bag, setAt, "purlin_size_in", g.purlin_size_in);
  const ridge = makeSizeSetter(bag, setAt, "ridge_size_in", g.ridge_size_in);
  const ringBeamCur = (framing.ring_beam as { size_in?: [number, number] } | undefined)?.size_in ??
    g.ring_beam_size_in;

  const rafterSpacing = (framing.rafter_spacing_in as number | undefined);
  const purlinSpacing = (framing.purlin_spacing_in as number | undefined);

  return (
    <Section title="Framing (metal frame overrides)">
      <div className="mb-2 text-[11px] text-slate-400">
        All fields blank = use the global defaults shown. Nominal sizes
        + on-centre spacings are in inches (industry convention).
      </div>

      {/* Rafters */}
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Rafter
      </div>
      <div className="grid grid-cols-3 gap-x-2">
        <NumberField
          label="Width (in)"
          hint={`default ${g.rafter_size_in[0]}`}
          value={(framing.rafter_size_in as [number, number] | undefined)?.[0]}
          onCommit={(v) => rafter.setW(v)}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Depth (in)"
          hint={`default ${g.rafter_size_in[1]}`}
          value={(framing.rafter_size_in as [number, number] | undefined)?.[1]}
          onCommit={(v) => rafter.setD(v)}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Spacing o.c. (in)"
          hint={`default ${g.rafter_spacing_in}`}
          value={rafterSpacing}
          onCommit={(v) => setAt(["framing", "rafter_spacing_in"], v)}
          allowEmpty
          min={1}
        />
      </div>

      {/* Purlins */}
      <div className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Purlin
      </div>
      <div className="grid grid-cols-3 gap-x-2">
        <NumberField
          label="Width (in)"
          hint={`default ${g.purlin_size_in[0]}`}
          value={(framing.purlin_size_in as [number, number] | undefined)?.[0]}
          onCommit={(v) => purlin.setW(v)}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Depth (in)"
          hint={`default ${g.purlin_size_in[1]}`}
          value={(framing.purlin_size_in as [number, number] | undefined)?.[1]}
          onCommit={(v) => purlin.setD(v)}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Spacing o.c. (in)"
          hint={`default ${g.purlin_spacing_in}`}
          value={purlinSpacing}
          onCommit={(v) => setAt(["framing", "purlin_spacing_in"], v)}
          allowEmpty
          min={1}
        />
      </div>

      {/* Ridge */}
      <div className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Ridge beam
      </div>
      <div className="grid grid-cols-2 gap-x-2">
        <NumberField
          label="Width (in)"
          hint={`default ${g.ridge_size_in[0]}`}
          value={(framing.ridge_size_in as [number, number] | undefined)?.[0]}
          onCommit={(v) => ridge.setW(v)}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Depth (in)"
          hint={`default ${g.ridge_size_in[1]}`}
          value={(framing.ridge_size_in as [number, number] | undefined)?.[1]}
          onCommit={(v) => ridge.setD(v)}
          allowEmpty
          min={0.1}
        />
      </div>

      {/* Ring beam */}
      <div className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Ring beam (perimeter)
      </div>
      <div className="grid grid-cols-2 gap-x-2">
        <NumberField
          label="Width (in)"
          hint={`default ${g.ring_beam_size_in[0]}`}
          value={ringBeamCur[0] === g.ring_beam_size_in[0]
            ? (framing.ring_beam as { size_in?: [number, number] } | undefined)?.size_in?.[0]
            : ringBeamCur[0]}
          onCommit={(v) => {
            if (v === undefined) setAt(["framing", "ring_beam"], undefined);
            else setAt(["framing", "ring_beam", "size_in"], [v, ringBeamCur[1]]);
          }}
          allowEmpty
          min={0.1}
        />
        <NumberField
          label="Depth (in)"
          hint={`default ${g.ring_beam_size_in[1]}`}
          value={(framing.ring_beam as { size_in?: [number, number] } | undefined)?.size_in?.[1]}
          onCommit={(v) => {
            if (v === undefined) setAt(["framing", "ring_beam"], undefined);
            else setAt(["framing", "ring_beam", "size_in"], [ringBeamCur[0], v]);
          }}
          allowEmpty
          min={0.1}
        />
      </div>
    </Section>
  );
}
