// Roof preview panel — renders the master `roof_plan.svg` and its 13
// individual panels using the same generator (editor/src/svg2d/roof/)
// that the Python parity harness diffs byte-identically. The hand-drawn
// eave cross-section SVG is fetched over HTTP from the published
// docs/2d/roof/ so the embedded eave panel matches the disk pipeline.
//
// Also shows a v2 top-view panel for the unified roof (type: "roof")
// via the segment-based pipeline.

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import {
  computeRoofSections,
  type RoofSectionsResult,
} from "../svg2d/roof/index";
import type { HouseConfig as ExpandHouseConfig } from "../svg2d/expand";
import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import { renderTopViewPanel } from "../svg2d/roof/v2/topViewPanel";
import { computeAllBom, type FrameBomRow, type MetalBomRow } from "../svg2d/roof/v2/bom";

// Public path (served from docs/2d/roof/) of the hand-drawn detail we
// embed into the eave-cross-section panel. Fetched once and cached.
const EAVE_CROSS_SECTION_URL = "../2d/roof/roof-cross-section.svg";

interface V2Bundle {
  svg: string;
  frame: FrameBomRow[];
  metal: MetalBomRow[];
  planeCount: number;
  memberCount: number;
}

export function RoofPreview() {
  const config = useConfigStore((s) => s.config)!;
  const [eaveSvg, setEaveSvg] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string>("master");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(EAVE_CROSS_SECTION_URL)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => { if (!cancelled) setEaveSvg(text || undefined); })
      .catch(() => { if (!cancelled) setEaveSvg(undefined); });
    return () => { cancelled = true; };
  }, []);

  const legacyResult: RoofSectionsResult | null = useMemo(
    () => computeRoofSections(
      config as ExpandHouseConfig,
      { eaveCrossSectionSvg: eaveSvg },
    ),
    [config, eaveSvg],
  );

  // Compute the v2 top-view + BOM for v2 roof objects (type: "roof").
  const v2: V2Bundle | null = useMemo(() => {
    try {
      const spec = computeMergedV2Spec(config as ExpandHouseConfig, {
        filter: "v2Only",
      });
      if (spec.planes.length === 0 && spec.members.length === 0) return null;
      const svg = renderTopViewPanel(spec, {
        width: 900, height: 620,
        title: "v2 roofs — top view",
      });
      const bom = computeAllBom(spec);
      return {
        svg,
        frame: bom.frame,
        metal: bom.metal,
        planeCount: spec.planes.length,
        memberCount: spec.members.length,
      };
    } catch (e) {
      console.warn("[roofpreview v2] compute failed:", e);
      return null;
    }
  }, [config]);

  if (!legacyResult && !v2) {
    return (
      <div className="mx-auto max-w-lg rounded border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        <p>No roof in the current configuration.</p>
        <p className="mt-2 text-xs text-slate-500">
          Add a <code className="rounded bg-slate-800 px-1">roof</code>
          {" "}object to any floor to see the roof drawings here.
        </p>
      </div>
    );
  }

  const items: {
    key: string; label: string; svg: string; filename: string;
    kind: "legacy" | "v2-top" | "v2-frame-bom" | "v2-metal-bom";
    bomRows?: FrameBomRow[] | MetalBomRow[];
  }[] = [];

  if (legacyResult) {
    items.push({
      key: "master", label: "Master (all legacy panels)",
      svg: legacyResult.master.content,
      filename: legacyResult.master.filename,
      kind: "legacy",
    });
    for (const p of legacyResult.panels) {
      items.push({
        key: p.id, label: p.title,
        svg: p.content, filename: p.filename, kind: "legacy",
      });
    }
  }

  if (v2) {
    items.push({
      key: "v2-top-view",
      label: `v2 top view (${v2.planeCount} planes, ${v2.memberCount} members)`,
      svg: v2.svg,
      filename: "v2_top_view.svg",
      kind: "v2-top",
    });
    if (v2.frame.length > 0) {
      items.push({
        key: "v2-frame-bom",
        label: `v2 Frame BOM (${v2.frame.length} rows)`,
        svg: "",
        filename: "v2_frame_bom.json",
        kind: "v2-frame-bom",
        bomRows: v2.frame,
      });
    }
    if (v2.metal.length > 0) {
      items.push({
        key: "v2-metal-bom",
        label: `v2 Metal BOM (${v2.metal.length} specs)`,
        svg: "",
        filename: "v2_metal_bom.json",
        kind: "v2-metal-bom",
        bomRows: v2.metal,
      });
    }
  }

  const current = items.find((i) => i.key === selected) ?? items[0];

  const download = () => {
    const payload = current.kind === "legacy" || current.kind === "v2-top"
      ? current.svg
      : JSON.stringify(current.bomRows, null, 2);
    const mime = current.kind === "legacy" || current.kind === "v2-top"
      ? "image/svg+xml"
      : "application/json";
    const blob = new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setSelected(it.key)}
            className={clsx(
              "rounded px-3 py-1 text-xs",
              selected === it.key
                ? it.kind.startsWith("v2") ? "bg-fuchsia-600 text-white" : "bg-emerald-600 text-white"
                : it.kind.startsWith("v2")
                  ? "bg-fuchsia-900 text-fuchsia-200 hover:bg-fuchsia-800"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
            title={it.filename}
          >
            {it.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600"
          >
            {showRaw ? "Preview" : "View raw"}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600"
          >
            Download {current.filename}
          </button>
        </div>
      </div>

      {current.kind === "v2-frame-bom" ? (
        <FrameBomTable rows={current.bomRows as FrameBomRow[]} />
      ) : current.kind === "v2-metal-bom" ? (
        <MetalBomTable rows={current.bomRows as MetalBomRow[]} />
      ) : showRaw ? (
        <pre className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
          {current.svg}
        </pre>
      ) : (
        <div
          className="flex-1 overflow-auto rounded border border-slate-800 bg-white p-2"
          // Safe: the SVG comes from our own generator, not user input.
          dangerouslySetInnerHTML={{ __html: current.svg }}
        />
      )}
    </div>
  );
}

function FrameBomTable({ rows }: { rows: FrameBomRow[] }) {
  return (
    <div className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3">
      <table className="w-full text-xs text-slate-200">
        <thead className="border-b border-slate-700 text-slate-400">
          <tr>
            <th className="pr-4 text-left">Item</th>
            <th className="pr-4 text-left">Role</th>
            <th className="pr-4 text-left">Material spec</th>
            <th className="pr-4 text-right">Count</th>
            <th className="pr-4 text-right">Max ft</th>
            <th className="text-right">Total ft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-800">
              <td className="py-1 pr-4">{r.item}</td>
              <td className="py-1 pr-4 text-slate-400">{r.role}</td>
              <td className="py-1 pr-4 font-mono">{r.matSpec}</td>
              <td className="py-1 pr-4 text-right tabular-nums">{r.count}</td>
              <td className="py-1 pr-4 text-right tabular-nums">{r.maxLenFt.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums">{r.totalLenFt.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetalBomTable({ rows }: { rows: MetalBomRow[] }) {
  return (
    <div className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3">
      <table className="w-full text-xs text-slate-200">
        <thead className="border-b border-slate-700 text-slate-400">
          <tr>
            <th className="pr-4 text-left">Material spec</th>
            <th className="pr-4 text-right">Total ft</th>
            <th className="pr-4 text-right">Stock ft</th>
            <th className="pr-4 text-right">Pieces</th>
            <th className="text-left">Contributing items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-800">
              <td className="py-1 pr-4 font-mono">{r.matSpec}</td>
              <td className="py-1 pr-4 text-right tabular-nums">{r.totalLenFt.toFixed(2)}</td>
              <td className="py-1 pr-4 text-right tabular-nums">{r.stockLenFt}</td>
              <td className="py-1 pr-4 text-right tabular-nums font-semibold">{r.piecesToOrder}</td>
              <td className="py-1 text-slate-400">{r.contributingItems.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
