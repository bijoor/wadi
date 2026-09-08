// Splice room-layout edits back into the real rooms.wdl source, preserving its header, comments,
// and every untouched room. The layout editor stages edits (replace / insert / delete) and calls
// applyLayoutEdits to produce the whole file to download; the author drops it in and runs
// `npm run build-layouts`. Kept pure + text-only (no DSL parse) so it round-trips predictably.

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const r0 = (n) => Math.round(Number(n) || 0)

export const layoutName = (draft) => `${slug(draft.type) || 'type'}_${slug(draft.variant) || 'variant'}`

// A `    room …` block (4-space indent, 6-space items) for a draft. A furniture-free layout
// (balcony/terrace) is emitted as a single headerline with no braces, matching the pack.
export function emitRoomBlock(draft, at = { x: 0, y: 0 }) {
  const name = layoutName(draft)
  const height = draft.height != null && draft.height !== '' ? ` height ${r0(draft.height)}` : ''
  const head = `    room ${name} at (${r0(at.x)}, ${r0(at.y)}) size (${r0(draft.w)}, ${r0(draft.h)})${height}`
  const items = (draft.pieces || []).map((p) => {
    const g = (r0(p.gap_x) || r0(p.gap_y)) ? ` gap (${r0(p.gap_x)}, ${r0(p.gap_y)})` : ''
    const rot = p.rotation ? ` rotation ${p.rotation}` : ''
    return `      item f."${p.asset.id}" anchor ${p.anchor}${g}${rot}`
  })
  return items.length ? `${head} {\n${items.join('\n')}\n    }` : head
}

const HEADER_RE = /^([ \t]*)room[ \t]+([A-Za-z0-9_]+)[ \t]+at[ \t]*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)[ \t]+size[ \t]*\(\s*(\d+)\s*,\s*(\d+)\s*\)(?:[ \t]+height[ \t]+(\d+))?/gm

// Every `room …` block in the source, with its name, at-position, size, and char range. A block
// with a `{` runs to its matching `}`; a headerline-only room ends at its line end.
export function parseRoomBlocks(source) {
  const blocks = []
  HEADER_RE.lastIndex = 0
  let m
  while ((m = HEADER_RE.exec(source)) !== null) {
    const name = m[2]
    const start = m.index
    let i = m.index + m[0].length
    // skip spaces to see whether a brace block follows
    while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++
    let end
    if (source[i] === '{') {
      let depth = 0
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') { depth--; if (depth === 0) { i++; break } }
      }
      end = i
    } else {
      const nl = source.indexOf('\n', m.index)
      end = nl === -1 ? source.length : nl
    }
    const type = name.replace(/_[a-z0-9]+$/i, '')
    blocks.push({
      name, type, variant: name.startsWith(type + '_') ? name.slice(type.length + 1) : name,
      x: Number(m[3]), y: Number(m[4]), w: Number(m[5]), h: Number(m[6]),
      height: m[7] != null ? Number(m[7]) : null, start, end,
    })
  }
  return blocks
}

// Grow `site { plot (W, H) }` so it encloses every room (rooms below the old plot are fine, but
// keeping the plot around them keeps the authoring canvas tidy).
function growPlot(text) {
  const blocks = parseRoomBlocks(text)
  if (!blocks.length) return text
  const maxX = Math.max(...blocks.map((b) => b.x + b.w))
  const maxY = Math.max(...blocks.map((b) => b.y + b.h))
  return text.replace(/(plot[ \t]*\(\s*)(\d+)(\s*,\s*)(\d+)(\s*\))/, (mm, a, w, c, h, e) =>
    `${a}${Math.max(Number(w), maxX + 20)}${c}${Math.max(Number(h), maxY + 20)}${e}`)
}

// Insert new room blocks before the balcony/terrace section (or, failing that, before the floor's
// closing brace) so they sit inside the floor.
function insertBlocks(text, blocks) {
  const chunk = blocks.join('\n\n') + '\n\n'
  const marker = text.indexOf('// ===== Balcony')
  const at = marker !== -1
    ? text.lastIndexOf('\n', marker) + 1
    : (() => { // fallback: before the last two closing braces (floor }, house })
        const houseClose = text.lastIndexOf('}')
        const floorClose = text.lastIndexOf('}', houseClose - 1)
        return text.lastIndexOf('\n', floorClose) + 1
      })()
  return text.slice(0, at) + chunk + text.slice(at)
}

// Apply staged edits to the source. `edits`: [{ op:'replace'|'insert'|'delete', name, draft? }].
// An insert whose name already exists becomes a replace; a replace/delete of a missing room is a
// no-op. New rooms are stacked below the others with a fresh `at`, and the plot grows to fit.
export function applyLayoutEdits(source, edits) {
  const byName = new Map(parseRoomBlocks(source).map((b) => [b.name, b]))
  const replaces = [], deletes = [], inserts = []
  for (const e of edits) {
    const b = byName.get(e.name)
    if (e.op === 'delete') { if (b) deletes.push(b) }
    else if (b) replaces.push({ e, b })
    else inserts.push(e)
  }
  // Replace/delete in place, from the end so earlier ranges stay valid.
  const ops = [
    ...replaces.map(({ e, b }) => ({ start: b.start, end: b.end, text: emitRoomBlock(e.draft, { x: b.x, y: b.y }) })),
    ...deletes.map((b) => ({ start: b.start, end: b.end, del: true })),
  ].sort((a, b) => b.start - a.start)
  let text = source
  for (const op of ops) {
    if (op.del) {
      let end = op.end
      if (text[end] === '\n') end++ // swallow the block's trailing newline
      text = text.slice(0, op.start) + text.slice(end)
    } else {
      text = text.slice(0, op.start) + op.text + text.slice(op.end)
    }
  }
  if (inserts.length) {
    const cur = parseRoomBlocks(text)
    let y = cur.length ? Math.max(...cur.map((b) => b.y + b.h)) + 20 : 0
    const newBlocks = inserts.map((e) => {
      const block = emitRoomBlock(e.draft, { x: 0, y })
      y += (Number(e.draft.h) || 100) + 20
      return block
    })
    text = growPlot(insertBlocks(text, newBlocks))
  }
  return text
}
