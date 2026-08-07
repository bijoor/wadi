// Derive a template catalog entry's meta from a house config. ONE source of truth
// for both scripts/gen-catalog-index.ts (the dev-machine publish script) and the
// in-app "Publish template" panel (wadi-dsl/playground). Pure — no fs, no bpy, no
// three — so it runs in Node and in the browser.
//
// DERIVED from the config: bedrooms, bathrooms, floors, parametric, a default plot
// size. PRESERVED from a prior entry (editorial, human-authored): title,
// description, style, roof, minWidthFt, minLengthFt.

export interface TemplateMeta {
  bedrooms: number;
  bathrooms: number;
  floors: number;
  style: string;
  roof: string;
  minWidthFt: number;
  minLengthFt: number;
  parametric: boolean;
}

export interface TemplateEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  meta: TemplateMeta;
}

/** Editorial fields a config can't derive; carried from a prior index entry or a
 *  publish form. All optional — missing ones fall back to placeholders. */
export interface EditorialFields {
  title?: string;
  description?: string;
  style?: string;
  roof?: string;
  minWidthFt?: number;
  minLengthFt?: number;
}

type LooseConfig = {
  floors?: Array<{ name?: unknown; objects?: Array<{ type?: unknown; name?: unknown }> }>;
  variables?: Record<string, unknown>;
  site?: { plot_width?: unknown; plot_length?: unknown };
};

export const titleCase = (id: string): string =>
  id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Count bedroom / bathroom rooms by their name (a `room` object with a matching
 *  name). Bedrooms match /bed/i; bathrooms match /bath|toilet|\bwc\b/i. */
export function countRooms(cfg: LooseConfig): { bedrooms: number; bathrooms: number } {
  const rooms = (cfg.floors ?? []).flatMap((f) =>
    (f.objects ?? []).filter((o) => o?.type === "room"),
  );
  const named = rooms.map((r) => String(r.name ?? ""));
  const bedrooms = named.filter((n) => /bed/i.test(n)).length;
  const bathrooms = named.filter((n) => /bath|toilet|\bwc\b/i.test(n)).length;
  return { bedrooms, bathrooms };
}

/** Habitable storeys: floors that aren't a plinth / loft / roof-only level. */
export function countFloors(cfg: LooseConfig): number {
  const floors = cfg.floors ?? [];
  const habitable = floors.filter(
    (f) => !/plinth|loft|roof/i.test(String(f.name ?? "")),
  ).length;
  return Math.max(1, habitable);
}

/** A template is "parametric" (owner-adjustable) when it declares variables. */
export const isParametric = (cfg: LooseConfig): boolean =>
  !!(cfg.variables && Object.keys(cfg.variables).length > 0);

/** Rough default plot in display-feet (10 units = 1 ft in the atale convention),
 *  used only as a starting placeholder for brand-new templates. */
export function defaultPlotFt(cfg: LooseConfig): { minWidthFt: number; minLengthFt: number } {
  const ft = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n / 10) : undefined;
  };
  return {
    minWidthFt: ft(cfg?.site?.plot_width) ?? 30,
    minLengthFt: ft(cfg?.site?.plot_length) ?? 40,
  };
}

/** Assemble one catalog entry: derive the countable meta from `cfg`, and take the
 *  editorial fields from `prev` (a prior index entry or a publish form), falling
 *  back to placeholders. `file` is the config's filename in the catalog. */
export function deriveTemplateEntry(
  id: string,
  cfg: LooseConfig,
  file: string,
  prev?: EditorialFields,
): TemplateEntry {
  const { bedrooms, bathrooms } = countRooms(cfg);
  const plot = defaultPlotFt(cfg);
  return {
    id,
    title: prev?.title ?? titleCase(id),
    description: prev?.description ?? "",
    file,
    meta: {
      bedrooms,
      bathrooms,
      floors: countFloors(cfg),
      style: prev?.style ?? "—",
      roof: prev?.roof ?? "—",
      minWidthFt: prev?.minWidthFt ?? plot.minWidthFt,
      minLengthFt: prev?.minLengthFt ?? plot.minLengthFt,
      parametric: isParametric(cfg),
    },
  };
}
