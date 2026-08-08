// The "Publish template" panel in the WDL editor. It reuses the studio's capture +
// configurator by flipping the preview iframe to the architect persona while the
// panel is open (so the 📸/✨/🗂 toolbar and the "Preview as owner" toggle appear
// in the preview). The author captures cover shots, tests the configurator, fills
// in the details, and publishes a complete template package.
//
// The package = the COMPILED design (parametric layer intact) + the cover
// thumbnails captured in the preview + the editorial fields typed here. Assembly
// is pure (editor/src/templatePackage/assemble.ts); this module is only the DOM.

import {
  assembleTemplatePackage,
  normalizeId,
  type TemplatePackage,
} from "../../editor/src/templatePackage/assemble";

export type PublishResult = { ok: boolean; message: string };

export interface PublishPanelDeps {
  frame: HTMLIFrameElement;
  /** Flip the preview persona (studio reveals capture + configurator toggle). */
  setPreviewMode: (mode: "owner" | "studio") => Promise<void>;
  /** The most recent COMPILED config (the parametric source to publish). */
  getLastConfig: () => Record<string, unknown> | null;
  /** A suggested template id from the current filename. */
  suggestId: () => string;
  /** True in the desktop app (enables the real R2 push; browser downloads). */
  isTauri: () => boolean;
  /** Perform the publish/export of an assembled package. */
  doPublish: (pkg: TemplatePackage) => Promise<PublishResult>;
}

interface IframeWadi {
  getConfig: () => unknown;
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function initPublishPanel(deps: PublishPanelDeps): void {
  const $ = (id: string) => document.getElementById(id)!;
  const overlay = $("publish-overlay");
  const idEl = $("pub-id") as HTMLInputElement;
  const titleEl = $("pub-title") as HTMLInputElement;
  const descEl = $("pub-desc") as HTMLTextAreaElement;
  const styleEl = $("pub-style") as HTMLInputElement;
  const roofEl = $("pub-roof") as HTMLInputElement;
  const tagsEl = $("pub-tags") as HTMLInputElement;
  const derivedEl = $("pub-derived");
  const cardEl = $("pub-card");
  const statusEl = $("pub-status");
  const primaryEl = $("pub-primary") as HTMLButtonElement;

  // Read the current design from the preview: the parametric config is the last
  // COMPILE (the template's defaults, not the owner's runtime tweaks); the cover
  // thumbnails are whatever the author captured in the iframe.
  function readThumbnails(): string[] {
    const w = deps.frame.contentWindow as (Window & { wadi?: IframeWadi }) | null;
    const cfg = w?.wadi?.getConfig?.() as { thumbnails?: unknown } | undefined;
    return Array.isArray(cfg?.thumbnails)
      ? cfg!.thumbnails!.filter((x): x is string => typeof x === "string")
      : [];
  }

  const parseTags = (s: string): string[] =>
    s.split(",").map((t) => t.trim()).filter(Boolean);

  function currentForm() {
    const tags = parseTags(tagsEl.value);
    return {
      id: idEl.value,
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      style: styleEl.value.trim() || undefined,
      roof: roofEl.value.trim() || undefined,
      tags: tags.length ? tags : undefined,
    };
  }

  // Pre-fill the form from the design's own `template` metadata block (so an
  // imported .wadi / an edited WDL `template {}` populates the editor instead of
  // starting blank). The panel is a metadata EDITOR, not just a publish dialog.
  function prefillFromDesign(): void {
    const cfg = deps.getLastConfig();
    const t = (cfg?.template ?? {}) as {
      title?: string; description?: string; style?: string; roof?: string; tags?: unknown;
    };
    if (t.title) titleEl.value = t.title;
    if (t.description) descEl.value = t.description;
    if (t.style) styleEl.value = t.style;
    if (t.roof) roofEl.value = t.roof;
    if (Array.isArray(t.tags)) tagsEl.value = t.tags.filter((x) => typeof x === "string").join(", ");
  }

  // Assemble the package from the current form + design, or null if not ready.
  function tryAssemble(): { pkg: TemplatePackage; thumbs: number } | { error: string } {
    const base = deps.getLastConfig();
    if (!base) return { error: "Fix the compile errors first — nothing to publish." };
    const thumbs = readThumbnails();
    try {
      const pkg = assembleTemplatePackage(base, thumbs, currentForm());
      return { pkg, thumbs: thumbs.length };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  function renderCard(pkg: TemplatePackage): void {
    const cover = (pkg.wadi.thumbnails as string[] | undefined)?.[0];
    const m = pkg.entry.meta;
    const chips: string[] = [];
    if (m.bedrooms) chips.push(`${m.bedrooms} bed`);
    if (m.bathrooms) chips.push(`${m.bathrooms} bath`);
    chips.push(`${m.floors} floor${m.floors === 1 ? "" : "s"}`);
    if (m.style && m.style !== "—") chips.push(esc(m.style));
    if (m.roof && m.roof !== "—") chips.push(esc(m.roof));
    for (const tag of m.tags ?? []) chips.push(esc(tag));
    cardEl.innerHTML =
      (cover
        ? `<img class="pc-cover" src="${esc(cover)}" alt="cover" />`
        : `<div class="pc-cover empty">no cover shot yet — capture one with 📸 / ✨</div>`) +
      `<div class="pc-body">` +
      `<div class="pc-title">${esc(pkg.entry.title || pkg.entry.id || "Untitled")}</div>` +
      `<div class="pc-desc">${esc(pkg.entry.description || "No description yet.")}</div>` +
      `<div class="pc-chips">${chips.map((c) => `<span class="pc-chip">${c}</span>`).join("")}` +
      (m.parametric ? `<span class="pc-chip param">adjustable</span>` : "") +
      `</div></div>`;
  }

  function setStatus(msg: string, kind: "" | "ok" | "err" = ""): void {
    statusEl.textContent = msg;
    statusEl.className = "pub-status" + (kind ? " " + kind : "");
  }

  // Recompute the derived readout + card from the current design + form.
  function refresh(): void {
    const r = tryAssemble();
    if ("error" in r) {
      derivedEl.textContent = r.error;
      cardEl.innerHTML = "";
      primaryEl.disabled = true;
      return;
    }
    const m = r.pkg.entry.meta;
    derivedEl.textContent =
      `${m.bedrooms} bed · ${m.bathrooms} bath · ${m.floors} floor · ` +
      `${m.parametric ? "adjustable" : "fixed"} · ${r.thumbs} cover shot${r.thumbs === 1 ? "" : "s"}`;
    renderCard(r.pkg);
    primaryEl.disabled = false;
  }

  async function open(): Promise<void> {
    overlay.hidden = false;
    primaryEl.textContent = deps.isTauri() ? "Save to templates folder" : "Download .wadi";
    if (!idEl.value) idEl.value = normalizeId(deps.suggestId());
    // Reflect the design's own metadata (imported .wadi / WDL `template {}` block).
    prefillFromDesign();
    if (!titleEl.value) {
      titleEl.value = idEl.value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    setStatus("Flipping the preview to studio mode…");
    await deps.setPreviewMode("studio");
    setStatus("Capture cover shots + test the configurator in the preview, then publish.");
    refresh();
  }

  async function close(): Promise<void> {
    overlay.hidden = true;
    await deps.setPreviewMode("owner");
  }

  async function publish(): Promise<void> {
    const r = tryAssemble();
    if ("error" in r) return setStatus(r.error, "err");
    primaryEl.disabled = true;
    setStatus("Publishing…");
    try {
      const res = await deps.doPublish(r.pkg);
      setStatus(res.message, res.ok ? "ok" : "err");
    } catch (e) {
      setStatus((e as Error).message, "err");
    } finally {
      primaryEl.disabled = false;
    }
  }

  $("publish").addEventListener("click", () => void open());
  $("pub-close").addEventListener("click", () => void close());
  $("pub-refresh").addEventListener("click", refresh);
  primaryEl.addEventListener("click", () => void publish());
  for (const el of [idEl, titleEl, descEl, styleEl, roofEl, tagsEl]) el.addEventListener("input", refresh);
}
