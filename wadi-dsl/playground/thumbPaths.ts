// Cover-image path helpers for the WDL source-file workflow.
//
// Convention: a template's cover PNGs live in a `thumbnails/` subfolder that sits
// NEXT TO the .wdl (so the source folder stays uncluttered), named
// `<wdl-basename>-<n>.png`. The WDL `template {}` block references them by that
// relative path; the desktop app resolves the paths to inline data URLs at compile
// time and writes the files here when the author captures shots.
//
// Pure string/path logic only (no fs) so it is unit-testable and shared.

export const THUMB_SUBDIR = "thumbnails";

/** Join a directory and a relative path with a forward slash (WDL paths are
 *  forward-slash regardless of platform). */
export function joinRel(dir: string, rel: string): string {
  const d = dir.replace(/[/\\]+$/, "");
  return d ? `${d}/${rel}` : rel;
}

/** The parent directory of a file path (native separators preserved). */
export function parentDir(path: string): string {
  const m = path.match(/^(.*)[/\\][^/\\]*$/);
  return m ? m[1] : "";
}

/** The relative WDL path for cover shot `n` (1-based) of a `<base>.wdl`. */
export function thumbRelPath(base: string, n: number): string {
  return `${THUMB_SUBDIR}/${base}-${n}.png`;
}

/** Insert or replace the `thumbnails "..."` line inside the source's `template {}`
 *  block, creating the block after the `house` header if it is absent. Pure string
 *  surgery so it preserves the author's formatting everywhere else. Returns the new
 *  source (unchanged only if there is no `house` block to anchor to). */
export function patchThumbnails(src: string, paths: string[]): string {
  const line = `thumbnails ${paths.map((p) => JSON.stringify(p)).join(", ")}`;

  // 1) An existing `thumbnails` line → replace in place, keeping its indent.
  if (/^[ \t]*thumbnails[ \t]+.*$/m.test(src)) {
    return src.replace(/^([ \t]*)thumbnails[ \t]+.*$/m, `$1${line}`);
  }

  // 2) An existing `template {` block → insert right after its opening brace.
  const tpl = src.match(/^([ \t]*)template[ \t]*\{[ \t]*\r?\n/m);
  if (tpl && tpl.index !== undefined) {
    const indent = tpl[1] + "  ";
    const at = tpl.index + tpl[0].length;
    return src.slice(0, at) + `${indent}${line}\n` + src.slice(at);
  }

  // 3) No template block → create one right after the `house NAME {` header.
  const house = src.match(/^([ \t]*)house\b[^\n{]*\{[ \t]*\r?\n/m);
  if (house && house.index !== undefined) {
    const indent = house[1] + "  ";
    const at = house.index + house[0].length;
    const block = `${indent}template {\n${indent}  ${line}\n${indent}}\n`;
    return src.slice(0, at) + block + src.slice(at);
  }

  return src; // nothing to anchor to (source has no house block) — caller warns
}
