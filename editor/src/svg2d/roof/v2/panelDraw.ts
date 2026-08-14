// Shared drawing helpers for the v2 roof detail panels (frame-dimension
// plan, eave section, ...). Kept tiny and dependency-free so each panel
// stays a self-contained SVG-fragment builder.

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&#39;" : "&quot;",
  );
}

// A horizontal dimension line with end ticks and a centered label above it.
export function dimLineH(x1: number, x2: number, y: number, label: string): string {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  return (
    `<line x1="${lo.toFixed(1)}" y1="${y.toFixed(1)}" x2="${hi.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${lo.toFixed(1)}" y1="${(y - 3).toFixed(1)}" x2="${lo.toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${hi.toFixed(1)}" y1="${(y - 3).toFixed(1)}" x2="${hi.toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<text x="${((lo + hi) / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#334155">${escapeXml(label)}</text>\n`
  );
}

// A vertical dimension line with end ticks and a rotated label.
export function dimLineV(y1: number, y2: number, x: number, label: string): string {
  const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
  return (
    `<line x1="${x.toFixed(1)}" y1="${lo.toFixed(1)}" x2="${x.toFixed(1)}" y2="${hi.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${(x - 3).toFixed(1)}" y1="${lo.toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${lo.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${(x - 3).toFixed(1)}" y1="${hi.toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${hi.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<text x="${(x + 4).toFixed(1)}" y="${((lo + hi) / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#334155" transform="rotate(-90 ${(x + 4).toFixed(1)} ${((lo + hi) / 2).toFixed(1)})">${escapeXml(label)}</text>\n`
  );
}

// Panel chrome: outer frame + title bar. Returns the opening markup; the
// caller appends content then closes the group.
export function panelFrame(
  x0: number, y0: number, width: number, height: number,
  titleH: number, title: string, cls: string,
): string {
  const cx = x0 + width / 2;
  return (
    `<g class="${cls}">\n` +
    `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n` +
    `<rect x="${x0}" y="${y0}" width="${width}" height="${titleH}" fill="#f2ede4" stroke="#333" stroke-width="1"/>\n` +
    `<text x="${cx}" y="${y0 + 26}" text-anchor="middle" font-size="14" font-weight="600" fill="#222">${escapeXml(title)}</text>\n`
  );
}

// Section size ([w_ft, d_ft], project 10u = 1ft) → a compact feet-inches label
// like 4"×6". Uses inches for anything under a foot.
export function sectionFtLabel(s: [number, number] | undefined): string | null {
  if (!s) return null;
  const inch = (ft: number) => {
    const totalIn = Math.round(ft * 12);
    if (totalIn % 12 === 0 && totalIn >= 12) return `${totalIn / 12}'`;
    return `${totalIn}"`;
  };
  return `${inch(s[0])}×${inch(s[1])}`;
}
