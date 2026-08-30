// Gharkul (owner) Configurator panel. Renders the exposed inputs a template
// declares in its `configurator` section as friendly controls, and drives them
// straight into the shared store (updateVariables/updatePoints) — the model
// re-resolves and re-renders live via subscribeConfig. Vanilla-TS, mirrors the
// existing floating panels (Show layers / Lighting).
import type { HouseConfig } from "../schema/houseConfig";
import { resolveInputs, writeValue, type ResolvedConfigurator, type ResolvedInput } from "../configurator/spec";
import { useConfigStore } from "../state/configStore";

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtVal = (n: number, suffix: string) => (suffix ? `${round2(n)} ${suffix}` : String(round2(n)));

export function mountConfiguratorPanel(): void {
  const list = document.getElementById("viewer-config-list");
  const dock = document.getElementById("viewer-config-dock");
  const titleEl = document.getElementById("cfg-dock-title");
  if (!list || !dock) return;

  type Ctl = { input: HTMLInputElement | HTMLSelectElement; valueEl?: HTMLElement; meta: ResolvedInput };
  const controls = new Map<string, Ctl>();
  const defaults = new Map<string, number>();
  let lastSig = "";

  const store = () => useConfigStore.getState();

  function applyRaw(target: string, raw: number): void {
    const cfg = store().config as HouseConfig | null;
    if (!cfg) return;
    const patch = writeValue(cfg, target, raw);
    if ("variables" in patch && patch.variables) store().updateVariables(patch.variables);
    else if ("points" in patch && patch.points) store().updatePoints(patch.points);
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
    const reset = document.createElement("button");
    reset.className = "cfg-reset";
    reset.textContent = "Reset to defaults";
    reset.addEventListener("click", () => {
      for (const [t, raw] of defaults) applyRaw(t, raw);
    });
    list!.appendChild(reset);
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
    // Shown for ANY model that declares configurator inputs — the configurator is
    // the simple no-WDL edit surface (the left panel; the WDL editor is the right).
    const has = r.inputs.length > 0;
    // The dock shows via CSS on body[data-config="on"][data-left="open"]; the
    // header ☰ collapses it. Independent of the layers/camera popups.
    document.body.dataset.config = has ? "on" : "off";
    if (!has) {
      list!.innerHTML = "";
      lastSig = "";
      return;
    }
    const sig = JSON.stringify(r.section ?? null);
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
