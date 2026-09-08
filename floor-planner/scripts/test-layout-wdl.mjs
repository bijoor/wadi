// Tests for layoutWdl.js — parse room blocks and splice edits into the real rooms.wdl source,
// preserving the rest of the file. Also compiles the spliced output through the real pipeline to
// prove it stays valid.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseRoomBlocks, emitRoomBlock, applyLayoutEdits, layoutName } from '../src/export/layoutWdl.js'
import { compileDsl } from '../../wadi-dsl/src/generator/toHouseConfig.js'
import { makeFileResolver } from '../../wadi-dsl/src/cli/moduleResolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const inPath = resolve(here, '../../wadi-dsl/std-modules/rooms.wdl')
const source = readFileSync(inPath, 'utf8')

let fail = 0
const ok = (c, m) => { if (!c) { console.log('FAIL', m); fail++ } else console.log('ok  ', m) }

// ---- parse ----
const blocks = parseRoomBlocks(source)
ok(blocks.length === 30, `parsed 30 room blocks (got ${blocks.length})`)
ok(blocks.some((b) => b.name === 'kitchen_xs' && b.w === 78 && b.h === 46), 'kitchen_xs parsed with size 78x46')
ok(blocks.some((b) => b.name === 'balcony_a' && b.height === 35), 'balcony_a parsed with height 35 (headerline, no braces)')
const bx = blocks.find((b) => b.name === 'bedroom_xs')
ok(source.slice(bx.start, bx.end).startsWith('    room bedroom_xs'), 'block range starts at the room keyword')
ok(source.slice(bx.start, bx.end).trimEnd().endsWith('}'), 'block range ends at the closing brace')

// ---- emit ----
const draft = { type: 'kitchen', variant: 'test', w: 90, h: 60, pieces: [
  { asset: { id: 'stove' }, anchor: 'top-center', gap_x: 0, gap_y: 4 },
  { asset: { id: 'chair' }, anchor: 'center', gap_x: 0, gap_y: -30 },
] }
const emitted = emitRoomBlock(draft, { x: 5, y: 7 })
ok(emitted.includes('room kitchen_test at (5, 7) size (90, 60) {'), 'emit header')
ok(emitted.includes('item f."stove" anchor top-center gap (0, 4)'), 'emit item with gap')
ok(emitted.includes('gap (0, -30)'), 'emit negative gap literal')
ok(layoutName(draft) === 'kitchen_test', 'layoutName slugs type_variant')

// Rotation must be lossless vs the anchor's natural facing: a value that DIFFERS is emitted
// (including 0), one that EQUALS the anchor default is omitted (the pipeline reconstructs it).
{
  const sideZero = { type: 'bedroom', variant: 'x', w: 95, h: 95, pieces: [
    { asset: { id: 'bed_single' }, anchor: 'center-left', gap_x: 0, gap_y: 0, rotation: 0 },
  ] }
  ok(emitRoomBlock(sideZero).includes('anchor center-left rotation 0'), 'emit rotation 0 on a side wall (differs from anchor default 90)')
  const sideDefault = { type: 'bedroom', variant: 'x', w: 95, h: 95, pieces: [
    { asset: { id: 'wardrobe' }, anchor: 'center-right', gap_x: 0, gap_y: 0, rotation: 270 },
  ] }
  const line = emitRoomBlock(sideDefault).split('\n').find((l) => l.includes('wardrobe'))
  ok(/anchor center-right\s*$/.test(line.trimEnd()), 'omit rotation when it equals the anchor default (270 on center-right)')
}

// ---- replace (in place, keeps at + rest of file) ----
{
  const edit = { op: 'replace', name: 'kitchen_xs', draft: { type: 'kitchen', variant: 'xs', w: 78, h: 46, pieces: [
    { asset: { id: 'stove' }, anchor: 'top-center', gap_x: 0, gap_y: 4 },
  ] } }
  const out = applyLayoutEdits(source, [edit])
  const b2 = parseRoomBlocks(out).filter((b) => b.name === 'kitchen_xs')
  ok(b2.length === 1, 'still exactly one kitchen_xs after replace')
  ok(out.includes('item f."stove" anchor top-center gap (0, 4)') && !out.includes('kitchen_cabinet') === false, 'replaced kitchen_xs body present')
  ok(out.includes('// ===== Compact + extra layouts'), 'untouched comments preserved')
  ok(parseRoomBlocks(out).length === blocks.length, 'block count unchanged by replace')
}

// ---- insert (new room appended, plot grows) ----
{
  const edit = { op: 'insert', name: 'kitchen_new', draft: { type: 'kitchen', variant: 'new', w: 80, h: 50, pieces: [
    { asset: { id: 'stove' }, anchor: 'top-center', gap_x: 0, gap_y: 4 },
  ] } }
  const out = applyLayoutEdits(source, [edit])
  const names = parseRoomBlocks(out).map((b) => b.name)
  ok(names.includes('kitchen_new'), 'insert added kitchen_new')
  ok(parseRoomBlocks(out).length === blocks.length + 1, 'block count +1 after insert')
  const inserted = parseRoomBlocks(out).find((b) => b.name === 'kitchen_new')
  const others = parseRoomBlocks(out).filter((b) => b.name !== 'kitchen_new')
  const overlaps = others.some((o) => inserted.x < o.x + o.w && o.x < inserted.x + inserted.w && inserted.y < o.y + o.h && o.y < inserted.y + inserted.h)
  ok(!overlaps, 'inserted room does not overlap any existing room')
}

// ---- delete ----
{
  const out = applyLayoutEdits(source, [{ op: 'delete', name: 'terrace_a' }])
  ok(!parseRoomBlocks(out).some((b) => b.name === 'terrace_a'), 'delete removed terrace_a')
  ok(parseRoomBlocks(out).length === blocks.length - 1, 'block count -1 after delete')
}

// ---- the spliced output still COMPILES through the real pipeline ----
{
  const edits = [
    { op: 'replace', name: 'kitchen_xs', draft: { type: 'kitchen', variant: 'xs', w: 78, h: 46, pieces: [
      { asset: { id: 'stove' }, anchor: 'top-center', gap_x: 0, gap_y: 4 },
      { asset: { id: 'kitchen_sink' }, anchor: 'top-right', gap_x: 2, gap_y: 4 },
    ] } },
    { op: 'insert', name: 'study_new', draft: { type: 'study', variant: 'new', w: 70, h: 70, pieces: [
      { asset: { id: 'desk' }, anchor: 'top-center', gap_x: 0, gap_y: 6 },
    ] } },
  ]
  const out = applyLayoutEdits(source, edits)
  let compiled
  try { compiled = compileDsl(out, { resolveModule: makeFileResolver(inPath) }); ok(!!compiled, 'spliced source compiles via compileDsl') }
  catch (e) { ok(false, 'spliced source compiles via compileDsl: ' + (e.message || e)) }
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS')
process.exit(fail ? 1 : 0)
