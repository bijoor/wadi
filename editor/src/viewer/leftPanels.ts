// LEFT panel system, presented as a vertical TOOL RAIL on the far-left edge — one
// icon+label button per tool, like an activity bar — with the active tool's panel
// beside it. Clicking a tool opens its panel (or switches to it); clicking the active
// tool again collapses the panel. This scales to many tools (vertical space) and drops
// the old horizontal tab strip + the single cryptic pull-tab. The WDL editor is the
// only RIGHT panel. A new tool is one registerLeftTool() call.
//
// CSS: the rail (#viewer-left-rail) shows when body[data-lefttools="on"]; the panel
// (#viewer-left-dock) shows when additionally data-left="open"; each tool's panel
// carries `lt-active` when it is the current tool.

export interface LeftTool {
  id: string;
  label: string;
  icon?: string;
  /** The tool's panel element (already in the DOM), shown when this tool is active. */
  panel: () => HTMLElement | null;
  /** Whether the tool's rail button is currently offered (e.g. 2D-only, owner-only). */
  available: () => boolean;
  /** Called when this tool becomes / stops being the active panel. */
  onShow?: () => void;
  onHide?: () => void;
}

const ACTIVE_KEY = "wadi:left-tool";
const OPEN_KEY = "wadi:left-panel";
const tools: LeftTool[] = [];
let activeId: string | null = null;
let railEl: HTMLElement | null = null;

export function registerLeftTool(tool: LeftTool): void {
  if (!tools.some((t) => t.id === tool.id)) tools.push(tool);
}

function availableTools(): LeftTool[] {
  return tools.filter((t) => {
    try { return t.available(); } catch { return false; }
  });
}

function isOpen(): boolean {
  return document.body.dataset.left === "open";
}

function setOpen(open: boolean): void {
  document.body.dataset.left = open ? "open" : "closed";
  try { localStorage.setItem(OPEN_KEY, open ? "open" : "closed"); } catch { /* ignore */ }
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

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function renderRail(): void {
  if (!railEl) return;
  const avail = availableTools();
  railEl.innerHTML = "";
  for (const t of avail) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "left-tool-railbtn" + (t.id === activeId && isOpen() ? " active" : "");
    b.title = t.label;
    b.setAttribute("aria-pressed", String(t.id === activeId && isOpen()));
    b.innerHTML = `<span class="rb-icon" aria-hidden="true">${t.icon ?? "•"}</span><span class="rb-lbl">${esc(t.label)}</span>`;
    b.addEventListener("click", () => {
      // Same tool while open → collapse; otherwise switch to it and open.
      if (activeId === t.id && isOpen()) setOpen(false);
      else { applyActive(t.id); setOpen(true); }
      refreshLeftDock();
    });
    railEl.appendChild(b);
  }
}

// Recompute available tools + the rail's visibility flag, keep a valid active tool,
// and redraw the rail. Call after anything that changes availability (config load,
// view switch) or the open state (agent hide/show). Idempotent + cheap.
export function refreshLeftDock(): void {
  const avail = availableTools();
  document.body.dataset.lefttools = avail.length ? "on" : "off";
  const keep = activeId && avail.some((t) => t.id === activeId) ? activeId : (avail[0]?.id ?? null);
  applyActive(keep);
  renderRail();
}

export function mountLeftDock(): void {
  railEl = document.getElementById("viewer-left-rail");
  try { activeId = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
  // Default OPEN unless a stored preference collapsed it (mirrors the old pull-tab).
  let openPref: string | null = null;
  try { openPref = localStorage.getItem(OPEN_KEY); } catch { /* ignore */ }
  document.body.dataset.left = openPref === "closed" ? "closed" : "open";
  refreshLeftDock();
}
