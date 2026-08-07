// Assemble a template package from the WDL-authoring workflow: the compiled config
// (the parametric source — variables / formulas / configurator intact) plus the
// cover thumbnails captured in the preview, plus the editorial fields the author
// typed. Pure, so both the Publish panel and a test can call it.

import { entryFromConfig, type TemplateEntry, type EditorialFields } from "./catalogMeta";

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

  // Make the config SELF-DESCRIBING: fold the editorial fields into a `template`
  // block on the .wadi, so a folder of these files can be auto-indexed with no
  // external index. Only keep the fields the author actually provided.
  const template: EditorialFields = {};
  if (form.title) template.title = form.title;
  if (form.description) template.description = form.description;
  if (form.style) template.style = form.style;
  if (form.roof) template.roof = form.roof;
  if (form.minWidthFt !== undefined) template.minWidthFt = form.minWidthFt;
  if (form.minLengthFt !== undefined) template.minLengthFt = form.minLengthFt;
  if (Object.keys(template).length) wadi.template = template;
  else delete wadi.template;

  const file = `${id}.wadi`;
  // Derive the catalog entry from the now-self-describing config, so the entry
  // and the file can never disagree.
  const entry = entryFromConfig(id, wadi, file);
  return { entry, wadi, file };
}
