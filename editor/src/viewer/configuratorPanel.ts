// Gharkul (owner) Configurator panel. Renders the exposed inputs a template
// declares in its `configurator` section as friendly controls, and drives them
// straight into the shared store (updateVariables/updatePoints) — the model
// re-resolves and re-renders live via subscribeConfig. Vanilla-TS, mirrors the
// existing floating panels (Show layers / Lighting).
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import { resolveInputs, writeValue, type ResolvedConfigurator, type ResolvedInput } from "../configurator/spec";
import { useConfigStore } from "../state/configStore";
import { furnishRoom } from "../furniture/furnish";
import { loadRoomLayouts } from "../furniture/loadRoomLayouts";

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtVal = (n: number, suffix: string) => (suffix ? `${round2(n)} ${suffix}` : String(round2(n)));

// A room can be auto-furnished when it declares a category (`type`) or carries a
// `furniture auto` source — realising the "furniture auto implies a config option"
// decision (plans/room-templates-in-wadi.md): the configurator surfaces a Furnish
// action for any such model.
function isFurnishable(o: Record<string, unknown>): boolean {
  if (o.type !== "room") return false;
  if (typeof o.room_type === "string" && o.room_type) return true;
  const f = o.furniture as Record<string, unknown> | undefined;
  return !!(f && (f.auto || f.auto_type || f.auto_room));
}
function countFurnishable(cfg: HouseConfig): number {
  let n = 0;
  for (const fl of (cfg.floors ?? []) as Array<{ objects?: Record<string, unknown>[] }>) {
    for (const o of fl.objects ?? []) if (isFurnishable(o)) n++;
  }
  return n;
}

export function mountConfiguratorPanel(): void {
  const list = document.getElementById("viewer-config-list");
  const dock = document.getElementById("viewer-config-dock");
  const titleEl = document.getElementById("cfg-dock-title");
  if (!list || !dock) return;

  type Ctl = { input: HTMLInputElement | HTMLSelectElement; valueEl?: HTMLElement; meta: ResolvedInput };
  const controls = new Map<string, Ctl>();
  const defaults = new Map<string, number>();
  let lastSig = "";
  // Auto-furnish: any configurator change re-runs the furnish action (debounced), so a room
  // re-matches a fitting template when a variable resizes it — the planner's live reflow,
  // now in the studio. `furnishing` guards against overlap with a manual Furnish.
  let furnishing = false;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  let statusRef: HTMLElement | null = null;

  const store = () => useConfigStore.getState();

  function applyRaw(target: string, raw: number): void {
    const cfg = store().config as HouseConfig | null;
    if (!cfg) return;
    const patch = writeValue(cfg, target, raw);
    if ("variables" in patch && patch.variables) store().updateVariables(patch.variables);
    else if ("points" in patch && patch.points) store().updatePoints(patch.points);
    scheduleAutoFurnish();
  }

  // Furnish every furnishable room from the current (resolved) config, writing each room's
  // updated furniture container back into the store. Returns how many were (re)furnished.
  // Shared by the manual Furnish button and the debounced auto-furnish.
  async function furnishNow(): Promise<{ done: number; total: number }> {
    const cfg0 = store().config as HouseConfig | null;
    if (!cfg0) return { done: 0, total: 0 };
    const layouts = await loadRoomLayouts();
    let done = 0;
    let total = 0;
    const floors = (cfg0.floors ?? []) as Array<{ floor_number?: number; objects?: Record<string, unknown>[] }>;
    for (let fi = 0; fi < floors.length; fi++) {
      const objs = floors[fi].objects ?? [];
      for (let oi = 0; oi < objs.length; oi++) {
        if (!isFurnishable(objs[oi])) continue;
        total++;
        const cur = store().config as HouseConfig | null;
        if (!cur) continue;
        const name = String(objs[oi].name);
        const floorNum = floors[fi].floor_number ?? fi + 1;
        const { config: next, result } = furnishRoom(cur as never, floorNum, name, layouts);
        if (result.furnished) {
          const nextRoom = (next.floors as Array<{ objects: Record<string, unknown>[] }>)[fi].objects[oi];
          store().updateObject({ floor: fi, object: oi }, { furniture: nextRoom.furniture } as Partial<HouseObject>);
          done++;
        }
      }
    }
    return { done, total };
  }

  // Debounced re-furnish after a config change. Only the last change in a burst (a slider drag,
  // a Reset) actually furnishes. `furnishRoom` skips locked blocks and re-matches by the room's
  // current size, so this is safe to run on every change; furnishing writes only furniture
  // (never variables), so it can't re-trigger itself.
  function scheduleAutoFurnish(): void {
    const cfg = store().config as HouseConfig | null;
    if (!cfg || countFurnishable(cfg) === 0) return;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(async () => {
      autoTimer = undefined;
      if (furnishing) { scheduleAutoFurnish(); return; } // a manual furnish is running — retry
      furnishing = true;
      try {
        const { done } = await furnishNow();
        if (statusRef) statusRef.textContent = done ? `Auto-furnished ${done} room${done === 1 ? "" : "s"}` : "";
      } catch {
        /* leave the current furniture in place on failure */
      } finally {
        furnishing = false;
      }
    }, 350);
  }

  // Auto-place furniture in every furnishable room (a native `type` or a `furniture
  // auto` source) from the template pack, writing into each room's `furniture`
  // container. Re-reads the live config between rooms so a room that clones a sibling
  // sees the sibling's furniture placed earlier in this pass.
  async function furnishAll(btn: HTMLButtonElement, status: HTMLElement): Promise<void> {
    if (furnishing) return;
    furnishing = true;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = undefined; } // supersede a pending auto-run
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Furnishing…";
    status.textContent = "";
    try {
      const { done, total } = await furnishNow();
      status.textContent = total ? `Furnished ${done}/${total} room${total === 1 ? "" : "s"}` : "No rooms have a type to furnish";
    } catch {
      status.textContent = "Furnish failed";
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      furnishing = false;
    }
  }

  // The "Furniture" section: a Furnish button + a status line. Built once (in build)
  // and updated in place, so a furnish doesn't force a panel rebuild.
  function buildFurnishSection(count: number): void {
    const gh = document.createElement("div");
    gh.className = "cfg-group";
    gh.textContent = "Furniture";
    list!.appendChild(gh);
    const row = document.createElement("div");
    row.className = "cfg-furnish-row";
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;";
    const btn = document.createElement("button");
    btn.className = "cfg-furnish";
    btn.textContent = `🛋 Furnish room${count === 1 ? "" : "s"}`;
    btn.title = "Auto-place furniture in every room that has a type. Runs automatically when you change a size.";
    btn.style.cssText = "padding:4px 12px;font-size:13px;font-weight:600;color:#0f1729;background:#f5c451;border:none;border-radius:5px;cursor:pointer;";
    const status = document.createElement("span");
    status.className = "cfg-furnish-msg";
    status.style.cssText = "font-size:11px;color:#94a3b8;";
    statusRef = status; // the auto-furnish writes its result here too
    btn.addEventListener("click", () => { void furnishAll(btn, status); });
    row.appendChild(btn);
    row.appendChild(status);
    list!.appendChild(row);
  }

  function buildRow(ri: ResolvedInput): void {
    const { input } = ri;
    if (Number.isFinite(ri.rawValue)) defaults.set(input.target, ri.rawValue);
    const row = document.createElement("div");
    row.className = "cfg-row";
    const lab = document.createElement("div");
    lab.className = "cfg-label";
    lab.textContent = input.label;
    row.appendChild(lab);
    if (input.description) {
      const help = document.createElement("div");
      help.className = "cfg-help";
      help.textContent = input.description;
      row.appendChild(help);
    }

    if (ri.control === "select" && input.options) {
      const sel = document.createElement("select");
      sel.className = "cfg-control";
      for (const o of input.options) {
        const opt = document.createElement("option");
        opt.value = String(o.value);
        opt.textContent = o.label;
        sel.appendChild(opt);
      }
      sel.value = String(ri.rawValue);
      sel.addEventListener("change", () => applyRaw(input.target, Number(sel.value)));
      row.appendChild(sel);
      controls.set(input.target, { input: sel, meta: ri });
    } else if (ri.control === "toggle") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "cfg-toggle";
      cb.checked = ri.rawValue !== 0;
      cb.addEventListener("change", () => applyRaw(input.target, cb.checked ? 1 : 0));
      lab.prepend(cb);
      controls.set(input.target, { input: cb, meta: ri });
    } else {
      const wrap = document.createElement("div");
      wrap.className = "cfg-slider-wrap";
      const rng = document.createElement("input");
      rng.type = ri.control === "slider" ? "range" : "number";
      rng.className = "cfg-control";
      if (ri.displayMin != null) rng.min = String(round2(ri.displayMin));
      if (ri.displayMax != null) rng.max = String(round2(ri.displayMax));
      if (ri.displayStep != null) rng.step = String(ri.displayStep);
      rng.value = String(round2(ri.displayValue));

      // Apply a DISPLAY-unit number: convert to raw, clamp, push to the store,
      // and return the (possibly clamped) display value to reflect back.
      const applyDisp = (dispNum: number): number => {
        const c = controls.get(input.target);
        const conv = c ? c.meta.conv : ri.conv;
        let raw = conv.toRaw(dispNum);
        if (typeof input.min === "number") raw = Math.max(input.min, raw);
        if (typeof input.max === "number") raw = Math.min(input.max, raw);
        applyRaw(input.target, raw);
        return round2(conv.toDisplay(raw));
      };

      // Sliders get an editable number box beside them so a value can be typed
      // as well as dragged; they stay in sync. (A plain number control is
      // already type-able, so it needs no extra box.)
      let valueEl: HTMLInputElement | undefined;
      if (ri.control === "slider") {
        const box = document.createElement("input");
        box.type = "number";
        box.className = "cfg-value";
        if (ri.displayMin != null) box.min = String(round2(ri.displayMin));
        if (ri.displayMax != null) box.max = String(round2(ri.displayMax));
        if (ri.displayStep != null) box.step = String(ri.displayStep);
        box.value = String(round2(ri.displayValue));
        rng.addEventListener("input", () => {
          const d = applyDisp(Number(rng.value));
          if (document.activeElement !== box) box.value = String(d);
        });
        // Live update while typing (don't rewrite the box mid-keystroke) …
        box.addEventListener("input", () => {
          const n = Number(box.value);
          if (!Number.isFinite(n)) return;
          rng.value = String(applyDisp(n));
        });
        // … and normalise/clamp on commit (blur / Enter).
        box.addEventListener("change", () => {
          const n = Number(box.value);
          if (!Number.isFinite(n)) {
            box.value = String(round2((controls.get(input.target)?.meta ?? ri).displayValue));
            return;
          }
          const d = applyDisp(n);
          box.value = String(d);
          rng.value = String(d);
        });
        valueEl = box;
      } else {
        rng.addEventListener("input", () => applyDisp(Number(rng.value)));
      }

      const unit = document.createElement("span");
      unit.className = "cfg-unit";
      unit.textContent = ri.conv.suffix;

      wrap.appendChild(rng);
      if (valueEl) wrap.appendChild(valueEl);
      if (ri.conv.suffix) wrap.appendChild(unit);
      row.appendChild(wrap);
      controls.set(input.target, { input: rng, valueEl, meta: ri });
    }
    list!.appendChild(row);
  }

  function build(r: ResolvedConfigurator): void {
    list!.innerHTML = "";
    controls.clear();
    defaults.clear();
    if (titleEl) titleEl.textContent = r.section?.title || "Configure your home";
    if (r.section?.description) {
      const d = document.createElement("p");
      d.className = "cfg-desc";
      d.textContent = r.section.description;
      list!.appendChild(d);
    }
    const groupIds = [...r.groups.map((g) => g.id), "__ungrouped"];
    const labelOf = new Map(r.groups.map((g) => [g.id, g.label]));
    for (const gid of groupIds) {
      const items = r.inputs.filter((i) => (i.input.group ?? "__ungrouped") === gid);
      if (!items.length) continue;
      const label = labelOf.get(gid);
      if (label) {
        const gh = document.createElement("div");
        gh.className = "cfg-group";
        gh.textContent = label;
        list!.appendChild(gh);
      }
      for (const ri of items) buildRow(ri);
    }
    // The Furnish action — auto-surfaced for any model with furnishable rooms.
    const cfg = store().config as HouseConfig | null;
    const fCount = cfg ? countFurnishable(cfg) : 0;
    if (fCount > 0) buildFurnishSection(fCount);
    // Reset only makes sense when there are configurator inputs to reset.
    if (r.inputs.length > 0) {
      const reset = document.createElement("button");
      reset.className = "cfg-reset";
      reset.textContent = "Reset to defaults";
      reset.addEventListener("click", () => {
        for (const [t, raw] of defaults) applyRaw(t, raw);
      });
      list!.appendChild(reset);
    }
  }

  function sync(r: ResolvedConfigurator): void {
    for (const ri of r.inputs) {
      const c = controls.get(ri.input.target);
      if (!c) continue;
      c.meta = ri;
      if (c.input instanceof HTMLSelectElement) {
        c.input.value = String(ri.rawValue);
      } else if (c.input.type === "checkbox") {
        c.input.checked = ri.rawValue !== 0;
      } else {
        // Don't clobber an input the user is currently typing into.
        if (document.activeElement !== c.input) c.input.value = String(round2(ri.displayValue));
        if (c.valueEl instanceof HTMLInputElement) {
          if (document.activeElement !== c.valueEl) c.valueEl.value = String(round2(ri.displayValue));
        } else if (c.valueEl) {
          c.valueEl.textContent = fmtVal(ri.displayValue, ri.conv.suffix);
        }
      }
    }
  }

  function render(): void {
    const cfg = store().config as HouseConfig | null;
    const r = cfg
      ? resolveInputs(cfg)
      : ({ section: undefined, groups: [], inputs: [] } as ResolvedConfigurator);
    // Shown for ANY model that declares configurator inputs, OR that has furnishable
    // rooms (the Furnish action is an auto-surfaced config option). The configurator is
    // the simple no-WDL edit surface (the left panel; the WDL editor is the right).
    const furnishable = cfg ? countFurnishable(cfg) : 0;
    const has = r.inputs.length > 0 || furnishable > 0;
    // The dock shows via CSS on body[data-config="on"][data-left="open"]; the
    // header ☰ collapses it. Independent of the layers/camera popups.
    document.body.dataset.config = has ? "on" : "off";
    if (!has) {
      list!.innerHTML = "";
      lastSig = "";
      return;
    }
    // Include the furnishable count so adding/removing a typed room rebuilds the panel.
    const sig = JSON.stringify({ section: r.section ?? null, furnishable });
    if (sig !== lastSig) {
      lastSig = sig;
      build(r);
    } else {
      sync(r);
    }
  }

  render();
  useConfigStore.subscribe(() => render());
}
