// Assemble a template package from the WDL-authoring workflow: the compiled config
// (the parametric source — variables / formulas / configurator intact) plus the
// cover thumbnails captured in the preview, plus the editorial fields the author
// typed. Pure, so both the Publish panel and a test can call it.

import { deriveTemplateEntry, type TemplateEntry, type EditorialFields } from "./catalogMeta";

export interface PublishForm extends EditorialFields {
  id: string;
}

export interface TemplatePackage {
  /** The catalog index entry (id, title, description, file, derived+editorial meta). */
  entry: TemplateEntry;
  /** The `.wadi` config to ship: the compiled design with cover thumbnails attached. */
  wadi: Record<string, unknown>;
  /** The catalog filename for the config (`<id>.wadi`). */
  file: string;
}

/** A template id must be a lowercase kebab/snake slug so it maps to a filename and
 *  an index key cleanly. */
export function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Combine the compiled config + captured thumbnails + form fields into a package.
 *  Throws if the id is empty after normalization. Thumbnails already embedded in
 *  the compiled config are overridden by the freshly-captured set (or dropped if
 *  none were captured). */
export function assembleTemplatePackage(
  compiled: Record<string, unknown>,
  thumbnails: string[],
  form: PublishForm,
): TemplatePackage {
  const id = normalizeId(form.id);
  if (!id) throw new Error("A template id is required (letters, digits, underscores).");

  const wadi: Record<string, unknown> = { ...compiled };
  if (thumbnails.length) wadi.thumbnails = thumbnails.slice();
  else delete wadi.thumbnails;
  // The legacy singular is never what a fresh package should carry.
  delete wadi.thumbnail;

  const file = `${id}.wadi`;
  const entry = deriveTemplateEntry(id, wadi, file, {
    title: form.title,
    description: form.description,
    style: form.style,
    roof: form.roof,
    minWidthFt: form.minWidthFt,
    minLengthFt: form.minLengthFt,
  });
  return { entry, wadi, file };
}
