import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { PreviewArea } from "./components/PreviewArea";
import { PropertyPanel } from "./components/PropertyPanel";
import { LayersEditor } from "./components/LayersEditor";
import { useConfigStore } from "./state/configStore";
import { validate } from "./schema/houseConfig";

export default function App() {
  const config = useConfigStore((s) => s.config);
  const loadConfig = useConfigStore((s) => s.loadConfig);

  // First-load convenience: when deployed at docs/editor/ the canonical
  // house_config.json sits at ../house_config.json. If it fetches OK and
  // validates, load it silently so the user sees content immediately —
  // otherwise stay on the empty-state prompt. Local dev typically fails
  // this (no static file served at that URL) and falls back gracefully.
  useEffect(() => {
    if (config) return;
    let cancelled = false;
    fetch("../house_config.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const result = validate(json);
        if (result.ok && result.data) {
          loadConfig(result.data, "house_config.json (from repo)");
        }
      })
      .catch(() => {
        /* silent — user can still Load JSON… manually */
      });
    return () => {
      cancelled = true;
    };
  }, [config, loadConfig]);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <PreviewArea />
        <PropertyPanel />
      </div>
      <LayersEditor />
    </div>
  );
}
