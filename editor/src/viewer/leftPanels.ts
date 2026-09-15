// Tabbed LEFT panel system. Contextual tools live on the LEFT, one visible at a
// time, chosen from a small registry; the WDL editor is the only RIGHT panel. Each
// tool declares when its tab is offered (e.g. 2D-only, owner-with-inputs) and which
// DOM panel it shows. New tools are one registerLeftTool() call — the configurator
// and the 2D filters panel are the first two; the furniture catalog will be next.
//
// The dock element (#viewer-left-dock) holds a tab strip (#viewer-left-tabs) and a
// body region containing each tool's panel; only the active tool's panel carries the
// `lt-active` class. The dock is shown by CSS when body[data-lefttools="on"] and the
// left panel is open (data-left="open"); the shared #left-toggle opens/closes it.

export interface LeftTool {
  id: string;
  label: string;
  icon?: string;
  /** The tool's panel element (already in the DOM), shown when this tool is active. */
  panel: () => HTMLElement | null;
  /** Whether the tool's tab is currently offered (e.g. 2D-only, owner-only). */
  available: () => boolean;
  /** Called when this tool becomes / stops being the active tab. */
  onShow?: () => void;
  onHide?: () => void;
}

const ACTIVE_KEY = "wadi:left-tool";
const tools: LeftTool[] = [];
let activeId: string | null = null;
let tabsEl: HTMLElement | null = null;

export function registerLeftTool(tool: LeftTool): void {
  if (!tools.some((t) => t.id === tool.id)) tools.push(tool);
}

function availableTools(): LeftTool[] {
  return tools.filter((t) => {
    try { return t.available(); } catch { return false; }
  });
}

// Show one tool's panel, hide the rest, and fire onShow/onHide. `id` null hides all.
function applyActive(id: string | null): void {
  for (const t of tools) {
    const el = t.panel();
    if (!el) continue;
    const on = t.id === id;
    if (el.classList.contains("lt-active") !== on) {
      el.classList.toggle("lt-active", on);
      if (on) t.onShow?.(); else t.onHide?.();
    }
  }
  activeId = id;
  if (id) { try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ } }
}

function renderTabs(): void {
  if (!tabsEl) return;
  const avail = availableTools();
  tabsEl.innerHTML = "";
  // A single tool needs no tab strip — the panel just shows.
  if (avail.length < 2) {
    tabsEl.hidden = true;
    return;
  }
  tabsEl.hidden = false;
  for (const t of avail) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "left-tool-tab" + (t.id === activeId ? " active" : "");
    b.textContent = (t.icon ? t.icon + " " : "") + t.label;
    b.title = t.label;
    b.addEventListener("click", () => {
      applyActive(t.id);
      renderTabs();
    });
    tabsEl.appendChild(b);
  }
}

// Recompute availability + the dock's visibility flag, keep a valid active tool, and
// redraw the tab strip. Call after anything that changes availability (config load,
// view switch). Idempotent + cheap.
export function refreshLeftDock(): void {
  const avail = availableTools();
  document.body.dataset.lefttools = avail.length ? "on" : "off";
  // Keep the stored/current tool if it's still available, else fall back to the first.
  const keep = activeId && avail.some((t) => t.id === activeId) ? activeId : (avail[0]?.id ?? null);
  applyActive(keep);
  renderTabs();
}

export function mountLeftDock(): void {
  tabsEl = document.getElementById("viewer-left-tabs");
  try { activeId = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
  refreshLeftDock();
}
