// Roof preview panel — renders the master `roof_plan.svg` and its 13
// individual panels using the same generator (editor/src/svg2d/roof/)
// that the Python parity harness diffs byte-identically. The hand-drawn
// eave cross-section SVG is fetched over HTTP from the published
// docs/2d/roof/ so the embedded eave panel matches the disk pipeline.

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import {
  computeRoofSections,
  type RoofSectionsResult,
} from "../svg2d/roof/index";
import type { HouseConfig as ExpandHouseConfig } from "../svg2d/expand";

// Public path (served from docs/2d/roof/) of the hand-drawn detail we
// embed into the eave-cross-section panel. Fetched once and cached.
const EAVE_CROSS_SECTION_URL = "../2d/roof/roof-cross-section.svg";

export function RoofPreview() {
  const config = useConfigStore((s) => s.config)!;
  const [eaveSvg, setEaveSvg] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string>("master");
  const [showRaw, setShowRaw] = useState(false);

  // Fetch the hand-drawn eave cross-section from the same origin as
  // the editor. Only runs once per page load. If it fails (offline,
  // 404), the eave panel falls back to the "not found" text stub.
  useEffect(() => {
    let cancelled = false;
    fetch(EAVE_CROSS_SECTION_URL)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => { if (!cancelled) setEaveSvg(text || undefined); })
      .catch(() => { if (!cancelled) setEaveSvg(undefined); });
    return () => { cancelled = true; };
  }, []);

  const result: RoofSectionsResult | null = useMemo(
    () => computeRoofSections(
      config as ExpandHouseConfig,
      { eaveCrossSectionSvg: eaveSvg },
    ),
    [config, eaveSvg],
  );

  if (!result) {
    return (
      <div className="mx-auto max-w-lg rounded border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        <p>No hip roof in the current configuration.</p>
        <p className="mt-2 text-xs text-slate-500">
          Add a <code className="rounded bg-slate-800 px-1">hip_roof</code>
          {" "}object to any floor to see the roof drawings here.
        </p>
      </div>
    );
  }

  const items: { key: string; label: string; svg: string; filename: string }[] = [
    { key: "master", label: "Master (all panels)", svg: result.master.content, filename: result.master.filename },
    ...result.panels.map((p) => ({
      key: p.id,
      label: p.title,
      svg: p.content,
      filename: p.filename,
    })),
  ];

  const current = items.find((i) => i.key === selected) ?? items[0];

  const download = () => {
    const blob = new Blob([current.svg], { type: "image/svg+xml" });
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
                ? "bg-emerald-600 text-white"
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

      {showRaw ? (
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
