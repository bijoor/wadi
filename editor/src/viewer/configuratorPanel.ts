// Gharkul (owner) Configurator panel. Renders the exposed inputs a template
// declares in its `configurator` section as friendly controls, and drives them
// straight into the shared store (updateVariables/updatePoints) — the model
// re-resolves and re-renders live via subscribeConfig. Vanilla-TS, mirrors the
// existing floating panels (Show layers / Lighting).
import type { HouseConfig } from "../schema/houseConfig";
import { resolveInputs, writeValue, type ResolvedConfigurator, type ResolvedInput } from "../configurator/spec";
import { useConfigStore } from "../state/configStore";
import { isOwner } from "./persona";

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
      const valueEl = document.createElement("span");
      valueEl.className = "cfg-value";
      valueEl.textContent = fmtVal(ri.displayValue, ri.conv.suffix);
      rng.addEventListener("input", () => {
        const c = controls.get(input.target);
        const conv = c ? c.meta.conv : ri.conv;
        let raw = conv.toRaw(Number(rng.value));
        if (typeof input.min === "number") raw = Math.max(input.min, raw);
        if (typeof input.max === "number") raw = Math.min(input.max, raw);
        valueEl.textContent = fmtVal(conv.toDisplay(raw), conv.suffix);
        applyRaw(input.target, raw);
      });
      wrap.appendChild(rng);
      wrap.appendChild(valueEl);
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
        c.input.value = String(round2(ri.displayValue));
        if (c.valueEl) c.valueEl.textContent = fmtVal(ri.displayValue, ri.conv.suffix);
      }
    }
  }

  function render(): void {
    const cfg = store().config as HouseConfig | null;
    const r = cfg
      ? resolveInputs(cfg)
      : ({ section: undefined, groups: [], inputs: [] } as ResolvedConfigurator);
    const has = isOwner() && r.inputs.length > 0;
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
  // Re-evaluate when the persona is switched in place (owner ⇄ architect).
  window.addEventListener("wadi:persona-changed", () => render());
}
