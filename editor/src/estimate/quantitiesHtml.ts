// HTML report for the Bill of Materials estimator. Sections become
// collapsible <details> blocks; rows are clean <table>s. Self-contained
// HTML string injected into svgMap and shown in the viewer's Quantities tab
// alongside the wall-area card. Mirrors the .wa-card styling of wallAreaHtml.ts.

import type { QuantityReport, QuantitySection, QuantityRow } from "./quantities";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const STYLE = `
  <style>
    @media print { .bom-card details { display: block !important; } }
    .bom-card { padding: 1rem 1.25rem; color: #1e293b; }
    .bom-card h2 { margin: 0 0 0.85rem 0; font-size: 1rem; color: #B85028; font-weight: 700;
      border-bottom: 2px solid #B85028; padding-bottom: 0.4rem; }
    .bom-card details { margin-top: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .bom-card summary { cursor: pointer; font-size: 0.87rem; font-weight: 600; color: #1e293b;
      padding: 0.5rem 0.75rem; background: #f8fafc; user-select: none; list-style: none; }
    .bom-card summary::-webkit-details-marker { display: none; }
    .bom-card summary::before { content: "▶ "; font-size: 0.7em; color: #94a3b8; }
    details[open] > .bom-card summary::before,
    .bom-card details[open] > summary::before { content: "▼ "; }
    .bom-card summary:hover { background: #f1f5f9; }
    .bom-card .section-body { padding: 0.5rem 0.75rem 0.6rem; }
    .bom-card table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 0.2rem; }
    .bom-card th, .bom-card td { text-align: left; padding: 0.35rem 0.5rem;
      border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .bom-card th { background: #f8fafc; font-weight: 600; color: #334155; font-size: 0.78rem; }
    .bom-card tbody tr:last-child td { border-bottom: none; }
    .bom-card td.num, .bom-card th.num { text-align: right; white-space: nowrap;
      font-variant-numeric: tabular-nums; }
    .bom-card td.note { color: #64748b; font-size: 0.77rem; }
    .bom-card .subtotal { margin: 0.3rem 0 0; font-size: 0.82rem; font-weight: 700;
      color: #B85028; text-align: right; }
    .bom-card .empty { color: #94a3b8; font-style: italic; font-size: 0.82rem;
      padding: 0.3rem 0; }
  </style>`;

function renderSection(s: QuantitySection): string {
  const hasArea     = s.rows.some((r) => r.area);
  const hasVolume   = s.rows.some((r) => r.volume);
  const hasCount    = s.rows.some((r) => r.count);
  const hasCapacity = s.rows.some((r) => r.capacity);
  const hasNotes    = s.rows.some((r) => r.notes);

  const heads: string[] = ["<th>Item</th>"];
  if (hasArea)     heads.push('<th class="num">Area</th>');
  if (hasVolume)   heads.push('<th class="num">Volume</th>');
  if (hasCount)    heads.push('<th class="num">Qty</th>');
  if (hasCapacity) heads.push('<th class="num">Capacity</th>');
  if (hasNotes)    heads.push("<th>Notes</th>");

  const bodyRows = s.rows.map((r: QuantityRow) => {
    const cells: string[] = [`<td>${escapeHtml(r.label)}</td>`];
    const dash = '<td class="num">—</td>';
    if (hasArea)     cells.push(r.area     ? `<td class="num">${escapeHtml(r.area)}</td>`         : dash);
    if (hasVolume)   cells.push(r.volume   ? `<td class="num">${escapeHtml(r.volume)}</td>`       : dash);
    if (hasCount)    cells.push(r.count    ? `<td class="num">${escapeHtml(r.count)}</td>`        : dash);
    if (hasCapacity) cells.push(r.capacity ? `<td class="num">${escapeHtml(r.capacity)}</td>`     : dash);
    if (hasNotes)    cells.push(r.notes    ? `<td class="note">${escapeHtml(r.notes)}</td>` : "<td></td>");
    return `<tr>${cells.join("")}</tr>`;
  });

  const subtotalHtml = s.subtotal
    ? `<p class="subtotal">${escapeHtml(s.subtotal)}</p>`
    : "";

  return `
  <details open>
    <summary>${escapeHtml(s.title)}</summary>
    <div class="section-body">
      <table>
        <thead><tr>${heads.join("")}</tr></thead>
        <tbody>${bodyRows.join("")}</tbody>
      </table>
      ${subtotalHtml}
    </div>
  </details>`;
}

export function quantitiesHtml(report: QuantityReport): string {
  const sections = report.sections.map(renderSection).join("");
  return `${STYLE}<div class="bom-card"><h2>Bill of Materials</h2>${sections}</div>`;
}
