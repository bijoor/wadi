import { useMemo, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import { generateAllFloorPlans } from "../svg2d/floorPlansAll";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateAllElevations } from "../svg2d/elevationsAll";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { ThreePreview } from "../three/ThreePreview";
import { RoofPreview } from "./RoofPreview";
import type { HouseConfig as ExpandHouseConfig } from "../svg2d/expand";

type Tab = "summary" | "plans" | "elevations" | "roof" | "3d";

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "plans", label: "Floor plans" },
  { id: "elevations", label: "Elevations" },
  { id: "roof", label: "Roof" },
  { id: "3d", label: "3D preview" },
];

export function PreviewArea() {
  const config = useConfigStore((s) => s.config);
  const [tab, setTab] = useState<Tab>("summary");

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-slate-950">
      <nav className="flex border-b border-slate-800 bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-2 border-r border-slate-800 px-4 py-2 text-sm",
              tab === t.id
                ? "bg-slate-950 text-slate-100"
                : "text-slate-400 hover:bg-slate-800/50",
            )}
          >
            {t.label}
            {t.badge && (
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-6">
        {!config && (
          <div className="mx-auto max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            <h2 className="mb-2 text-xl font-semibold text-slate-100">
              No configuration loaded
            </h2>
            <p className="mb-4 text-sm">
              Click <span className="text-slate-200">Load JSON…</span> in the top
              bar to open a <code className="rounded bg-slate-800 px-1">house_config.json</code>.
            </p>
            <p className="text-xs">
              The canonical file lives at{" "}
              <code className="rounded bg-slate-800 px-1">
                blender/house_config.json
              </code>{" "}
              in this repo.
            </p>
          </div>
        )}

        {config && tab === "summary" && <SummaryPanel />}
        {config && tab === "plans" && <FloorPlansPanel />}
        {config && tab === "elevations" && <ElevationsPanel />}
        {config && tab === "roof" && <RoofPreview />}
        {config && tab === "3d" && (
          <ThreePreview config={config as ExpandHouseConfig} />
        )}
      </div>
    </main>
  );
}

function SummaryPanel() {
  const config = useConfigStore((s) => s.config)!;
  const total = config.floors.reduce((s, f) => s + f.objects.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="rounded border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Site</h3>
        <dl className="grid grid-cols-4 gap-2 text-xs text-slate-400">
          <div>
            <dt>Plot length</dt>
            <dd className="text-slate-100">{config.site.plot_length}</dd>
          </div>
          <div>
            <dt>Plot width</dt>
            <dd className="text-slate-100">{config.site.plot_width}</dd>
          </div>
          <div>
            <dt>Plinth</dt>
            <dd className="text-slate-100">
              {config.plinth.length} × {config.plinth.width} × {config.plinth.height}
            </dd>
          </div>
          <div>
            <dt>Total objects</dt>
            <dd className="text-slate-100">{total}</dd>
          </div>
        </dl>
      </section>

      {config.floors.map((f) => {
        const byType = new Map<string, number>();
        f.objects.forEach((o) => byType.set(o.type, (byType.get(o.type) ?? 0) + 1));
        return (
          <section
            key={f.floor_number}
            className="rounded border border-slate-800 bg-slate-900 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-300">
              {f.name} · {f.objects.length} objects
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {[...byType.entries()].map(([type, count]) => (
                <span
                  key={type}
                  className="rounded bg-slate-800 px-2 py-1 text-slate-300"
                >
                  {type} · {count}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FloorPlansPanel() {
  const config = useConfigStore((s) => s.config)!;
  const [which, setWhich] = useState<"combined" | number>("combined");
  const [showRaw, setShowRaw] = useState(false);

  // Re-render whenever the config changes; memoize so the generator
  // isn't called on every unrelated re-render.
  const perFloor = useMemo(
    () => generateAllFloorPlans(config as ExpandHouseConfig),
    [config],
  );
  const combined = useMemo(
    () => generateCombinedFloorPlans(config as ExpandHouseConfig),
    [config],
  );

  const currentSvg =
    which === "combined"
      ? combined
      : perFloor[which]?.content ?? "";
  const currentName =
    which === "combined"
      ? "floor_plans_combined.svg"
      : perFloor[which]?.filename ?? "";

  const download = () => {
    if (!currentSvg) return;
    const blob = new Blob([currentSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWhich("combined")}
          className={clsx(
            "rounded px-3 py-1 text-sm",
            which === "combined"
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700",
          )}
        >
          Combined
        </button>
        {perFloor.map((f, i) => (
          <button
            key={f.filename}
            type="button"
            onClick={() => setWhich(i)}
            className={clsx(
              "rounded px-3 py-1 text-sm",
              which === i
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
          >
            {f.filename.replace("floor_plan_", "").replace(".svg", "")}
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
            disabled={!currentSvg}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-50"
          >
            Download {currentName}
          </button>
        </div>
      </div>

      {!currentSvg && (
        <div className="text-sm text-slate-500">
          No floor plan available for this selection.
        </div>
      )}
      {currentSvg && showRaw && (
        <pre className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
          {currentSvg}
        </pre>
      )}
      {currentSvg && !showRaw && (
        <div
          className="flex-1 overflow-auto rounded border border-slate-800 bg-white p-2"
          // dangerouslySetInnerHTML is safe here because the SVG comes
          // from our own generator, not user-supplied HTML.
          dangerouslySetInnerHTML={{ __html: currentSvg }}
        />
      )}
    </div>
  );
}

function ElevationsPanel() {
  const config = useConfigStore((s) => s.config)!;
  const [which, setWhich] = useState<"combined" | number>("combined");
  const [showRaw, setShowRaw] = useState(false);

  const perView = useMemo(
    () => generateAllElevations(config as ExpandHouseConfig),
    [config],
  );
  const combined = useMemo(
    () => generateCombinedElevations(config as ExpandHouseConfig),
    [config],
  );

  const currentSvg =
    which === "combined" ? combined : perView[which]?.content ?? "";
  const currentName =
    which === "combined"
      ? "elevations_combined.svg"
      : `elevation_${perView[which]?.view ?? ""}.svg`;

  const download = () => {
    if (!currentSvg) return;
    const blob = new Blob([currentSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWhich("combined")}
          className={clsx(
            "rounded px-3 py-1 text-sm",
            which === "combined"
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700",
          )}
        >
          Combined
        </button>
        {perView.map((v, i) => (
          <button
            key={v.view}
            type="button"
            onClick={() => setWhich(i)}
            className={clsx(
              "rounded px-3 py-1 text-sm capitalize",
              which === i
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
          >
            {v.view}
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
            disabled={!currentSvg}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-50"
          >
            Download {currentName}
          </button>
        </div>
      </div>

      {!currentSvg && (
        <div className="text-sm text-slate-500">
          No elevation available for this selection.
        </div>
      )}
      {currentSvg && showRaw && (
        <pre className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
          {currentSvg}
        </pre>
      )}
      {currentSvg && !showRaw && (
        <div
          className="flex-1 overflow-auto rounded border border-slate-800 bg-white p-2"
          dangerouslySetInnerHTML={{ __html: currentSvg }}
        />
      )}
    </div>
  );
}

