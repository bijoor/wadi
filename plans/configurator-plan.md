# Nakasha & Gharkul — two persona surfaces (+ the configurator layer)

Split the one app into two clearly-separated persona surfaces, and add a
product-configurator layer so end users can tune a template's exposed inputs
without touching structure.

- **Nakasha** (नकाशा — "the blueprint") — the **architect** surface. Authors
  templates: rooms/walls/roofs, `variables`/`points`/formulas, layers, and the
  configurator metadata. Used by architects with the `wadi-*` skills + Claude.
- **Gharkul** (घरकुल — "your own home") — the **house-owner** surface. View
  (3D / plans / elevations / roof / quantities) + a friendly **Configurator**
  (only the inputs a template exposes) + Load / Save / Share / Export. Never
  touches structure.

## Why now

Today both personas live in one app. The viewer app (`docs/app/`, from
`editor/viewer.html` + `editor/src/viewer/main.ts`, "the app") mixes viewing with
full structural editing behind an **"Edit" toggle** (`btn-edit-toggle` → `editMode`
→ mounts the React `Sidebar`/`PropertyPanel`). That toggle is the muddle: an owner
should never see structural editing. There are already **two build bundles**
(`vite.config.ts` → `docs/editor/`, React SPA; `vite.viewer.config.ts` →
`docs/app/`, vanilla viewer), which is the natural seam to split along later.

## The two surfaces

| | **Nakasha** (architect) | **Gharkul** (owner) |
|---|---|---|
| Goal | Author templates & their configurator | Tune exposed inputs, view, export |
| Controls | Full: object tree, PropertyPanel, add/remove objects, variables/points/formulas, layers, **+ author `configurator` metadata** | View tabs, **Configurator panel** (exposed inputs only), Load/Save/Share/Export, New-from-template, Undo/Redo, Print |
| Editing model | Structural — the whole `.wadi` | Parametric only — values of exposed variables/points; never structure |

## Separation mechanism

**Now (one codebase, clean split):** an explicit **`persona` = `owner` | `architect`**,
resolved at entry (distinct routes, persisted) — NOT a buried toggle. A single
`viewer/persona.ts` gates which UI mounts:

- **owner (Gharkul)** → view tabs + Configurator panel + export/share toolbar.
  Never mounts Sidebar/PropertyPanel/add-object. Retires `btn-edit-toggle`.
- **architect (Nakasha)** → everything owner has **plus** the edit panels (today's
  `editMode="on"` experience, promoted to first-class, no toggle) **plus** the
  configurator-authoring affordance.

Controls physically partition into `viewer/owner/*` and `viewer/architect/*`; shared
core (store, resolver, renderers, the `configurator/` read-write module) stays
common. Cross-nav: Gharkul has a quiet "Design a template (Nakasha) →"; Nakasha has
"Preview as owner / open Gharkul."

**Later (separate apps):** the `persona` seam maps onto the existing two bundles —
Nakasha → `docs/editor/` (the React SPA already there), Gharkul → `docs/app/`. Split
becomes a build-config change + dropping the other persona's modules. Resolved
decision: for now, keep both personas in `docs/app` as explicit modes (single
maintained app), building toward that seam.

## Schema — a new optional `configurator` section

Add to `HouseConfig` (`editor/src/schema/houseConfig.ts`, the `.strict()` object),
additive & optional so old configs still validate:

```jsonc
"configurator": {
  "title": "Configure your cottage",
  "groups": [ { "id": "size", "label": "Plot & size" }, { "id": "rooms", "label": "Rooms" } ],
  "inputs": [
    { "target": "House.W", "label": "Plot width",  "description": "Overall east–west width.",
      "unit": "ft", "min": 220, "max": 400, "step": 10, "group": "size" },
    { "target": "House.L", "label": "Plot length", "unit": "ft", "min": 340, "max": 560, "step": 10, "group": "size" },
    { "target": "minBathroomW", "label": "Min bathroom size", "unit": "ft", "min": 54, "max": 96, "step": 2, "group": "rooms" },
    { "target": "floorH", "label": "Ceiling height", "unit": "ft", "min": 90, "max": 120, "step": 2, "group": "size" }
  ]
}
```

- **`target`** references a **variable** (`floorH`) or a **point coordinate**
  (`House.W` → `points.House.x`; `W/L/X/Y/x/y` are the resolver's existing
  synonyms). One uniform reference so the plot size (a point) and knobs (variables)
  expose the same way.
- Parallel section (not inline per-variable metadata): keeps `variables`/`points`
  pure value maps (resolver, formula refs, every consumer unchanged), and lets the
  author pick *which* vars are exposed + their order and grouping.
- `control` (`slider`/`number`/`select`/`toggle`) and `unit` optional — inferred
  (options→select, min+max→slider, 0/1→toggle, `percent`→0–100 slider).
- `min`/`max`/`step` in **raw project units** (consistent with stored values); `unit`
  only affects *display* (reuse `svg2d/format.ts` `perUnit`, 10u = 1ft). [resolved]

## `configurator/` read-write module (shared TS)

`editor/src/configurator/spec.ts`:
- parse `target` → `{kind:"variable"|"point", name, coord?}`;
- `readValue(config, target)` (from the resolved config);
- `writeValue(config, target, raw)` → updated `variables`/`points` maps to hand to the store;
- `resolveInputs(config)` → normalized `{…, currentValue, control, displayUnit}` with
  inference + unit conversion (ft↔units, percent, count).
Pure, DOM-free, unit-tested. Used by both the Gharkul panel and the Nakasha affordance.

## Gharkul UI (owner)

Built vanilla-TS like the existing Show-layers / Lighting / Geometry-issues panels
(`editor/src/viewer/main.ts` + `editor/viewer.html`). A **Configurator panel** listing
exposed inputs, grouped, each with label + description + control showing the friendly
unit. On change → `writeValue` → `useConfigStore.updateVariables/updatePoints(...)` →
store re-resolves → `subscribeConfig()` re-renders 3D + active 2D tab **live** (already
wired). Clamp to min/max; surface the existing Geometry-issues state on invalid values;
Reset-to-defaults (snapshot template's original input values on load). Existing
Save/Share/.wadi export the configured result — no new output path.

## Nakasha authoring (architect)

- **Primary:** hand/skill authoring — document `configurator` in
  `wadi-config/reference/parametric-conventions.md` + `reference/schema.md`; the
  generators (`build_cottage.mjs`, `build_family_home.mjs`) emit a `configurator`
  block. Fits how architects already work.
- **Secondary:** an "Expose to configurator" affordance in the Variables/Points
  sections (`HouseSettingsForm.tsx`) that writes the metadata (visual authoring).

## Seed the library templates

Add real `configurator` blocks to the cottage & family-home generators (plot size,
key room mins, ceiling height…) so the picker's parametric templates ship a working
Gharkul configurator as demonstrators.

## Slices (order)

1. **Schema** `configurator` section + `configurator/spec.ts` (+ tests). No UI.
2. **Persona split**: `viewer/persona.ts` + gate the existing edit affordances
   (owner hides them; architect keeps them). Pure separation — verifies alone.
3. **Gharkul** Configurator panel wired to the store; seed cottage/family-home; live check.
4. **Nakasha** Expose-to-configurator affordance in Variables/Points.
5. Skill docs; rebuild viewer + reinstall Tauri; verify both personas.

## Verification

- Schema: old configs still validate; a config with `configurator` round-trips; `.strict()` catches typos.
- `configurator/spec.test.ts`: target parsing, read/write, unit conversion, control inference.
- Live: load the cottage in Gharkul → Configure → drag Plot width → 3D + floor plan
  update; min/max respected; Geometry-issues reflects invalid values; Reset restores.
- Nakasha still edits structurally; owner never sees structural controls.
- `npx tsc -b` clean, `npx vitest run` green, `npm run build`, browser check; rebuild + reinstall Tauri.

## Deferred (Phase 2)

Editor visual authoring polish; **options/choices** that set several variables at once
or toggle rooms via the `enabled`-formula feature (a real "2BR/3BR", "with pooja");
auto-deriving valid ranges from the model's envelope; full two-bundle app split.
