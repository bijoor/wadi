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

  // The `template {}` fields are an ORDERED grammar group:
  //   title → description → style → roof → tags → thumbnails → min_plot
  // so `thumbnails` must sit after `tags` and before `min_plot`. Inserting it
  // anywhere else fails to parse. Strip any existing (possibly mis-placed)
  // thumbnails line first, then insert at the one correct spot: just before
  // `min_plot` if present, else at the very end of the block.
  const stripped = src.replace(/^[ \t]*thumbnails[ \t]+.*\r?\n?/m, "");

  const tpl = stripped.match(/^([ \t]*)template[ \t]*\{[ \t]*\r?\n/m);
  if (tpl && tpl.index !== undefined) {
    const bodyIndent = tpl[1] + "  ";
    const bodyStart = tpl.index + tpl[0].length;
    // The template block has no nested braces, so its closing `}` is the first
    // line that is just a brace after the opening.
    const closeRel = stripped.slice(bodyStart).search(/^[ \t]*\}/m);
    const closeAbs = closeRel === -1 ? stripped.length : bodyStart + closeRel;
    const body = stripped.slice(bodyStart, closeAbs);

    const mp = body.match(/^([ \t]*)min_plot\b.*$/m);
    if (mp && mp.index !== undefined) {
      const at = bodyStart + mp.index;
      return stripped.slice(0, at) + `${mp[1]}${line}\n` + stripped.slice(at);
    }
    return stripped.slice(0, closeAbs) + `${bodyIndent}${line}\n` + stripped.slice(closeAbs);
  }

  // No template block → create one right after the `house NAME {` header.
  const house = stripped.match(/^([ \t]*)house\b[^\n{]*\{[ \t]*\r?\n/m);
  if (house && house.index !== undefined) {
    const indent = house[1] + "  ";
    const at = house.index + house[0].length;
    const block = `${indent}template {\n${indent}  ${line}\n${indent}}\n`;
    return stripped.slice(0, at) + block + stripped.slice(at);
  }

  return src; // nothing to anchor to (source has no house block) — caller warns
}
