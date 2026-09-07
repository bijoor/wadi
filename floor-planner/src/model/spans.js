// Elastic guide spans: the size model for one axis (see plans/elastic-guide-spans.md).
//
// An axis is a flexbox row of spans between guides. A span's POLICY is either FIXED (an
// absolute size) or FLEX (a ratio weight); fixed spans take their size and the leftover is
// split among flex spans by weight. A span may cover more than one cell (skip guides in
// between): it is then a GROUP whose interior guides subdivide it by the same rule. The
// defined spans must NEST (any two are disjoint or one contains the other), so the axis is a
// forest of nested intervals and distribution is a single top-down tree walk. No solver.
//
// Guides in: [{ id, at }] (extra fields ignored; `at` is the CURRENT position, used only for
// ordering and for the default cell size). Spans in: [{ lo, hi, policy }] where lo/hi are
// guide ids and policy is fixed()/flex(). Everything here is pure and framework-free.

export const fixed = (size) => ({ kind: 'fixed', size: Number(size) })
export const flex = (weight = 1) => ({ kind: 'flex', weight: Number(weight) })

const isFixed = (p) => p && p.kind === 'fixed'

// Order the guides and index them. Returns the sorted guides, an id->index map, and the
// current cell sizes (adjacent-guide gaps), which seed the default (non-destructive) policy.
function indexGuides(guides) {
  const sorted = [...(guides || [])].map((g) => ({ id: g.id, at: Number(g.at) })).sort((a, b) => a.at - b.at)
  const idIndex = new Map(sorted.map((g, i) => [g.id, i]))
  const cellSize = []
  for (let i = 0; i < sorted.length - 1; i++) cellSize.push(sorted[i + 1].at - sorted[i].at)
  return { sorted, idIndex, cellSize }
}

// Two half-open index intervals partially overlap when they intersect but neither contains
// the other. Those break nesting and are rejected.
function partialOverlap(a, b) {
  const [al, ah] = a, [bl, bh] = b
  return (al < bl && bl < ah && ah < bh) || (bl < al && al < bh && bh < ah)
}

// Build the nested-interval tree for one axis from the guides and the defined spans.
//
// Returns { root, guides, warnings }:
//   - root: the implicit whole-axis container. A node is { lo, hi, policy?, children? };
//     lo/hi are guide INDICES, `policy` is its size policy at its parent (the root has none),
//     and a node with `children` is a group (children tile [lo,hi] in order), a node without
//     is an atomic leaf cell [lo, lo+1].
//   - guides: the sorted [{id, at}] (so callers can map indices back to ids).
//   - warnings: spans that were dropped (endpoint not a guide, empty/reversed, or a
//     partial overlap that would break nesting).
//
// opts.defaultLeaf(loIdx, hiIdx, ctx) -> policy for an undefined atomic cell. Default: FLEX
// weighted by the cell's CURRENT size, so with no defined spans the distribution reproduces
// the current layout exactly and scales it proportionally (non-destructive adoption).
export function buildAxisTree(guides, spans = [], opts = {}) {
  const { sorted, idIndex, cellSize } = indexGuides(guides)
  const n = sorted.length
  const warnings = []
  const defaultLeaf = opts.defaultLeaf || ((lo) => flex(cellSize[lo] > 0 ? cellSize[lo] : 1))

  // Resolve each span to an index interval, dropping the ill-formed ones.
  const resolved = []
  for (const s of spans) {
    const lo = idIndex.get(s.lo), hi = idIndex.get(s.hi)
    if (lo == null || hi == null) { warnings.push({ span: s, reason: 'endpoint not on a guide' }); continue }
    if (hi <= lo) { warnings.push({ span: s, reason: 'empty or reversed span' }); continue }
    resolved.push({ lo, hi, policy: s.policy || flex(1), ref: s })
  }
  // Enforce nesting: keep spans in order, drop any that partially overlaps one already kept.
  const kept = []
  for (const s of resolved) {
    const clash = kept.find((k) => partialOverlap([s.lo, s.hi], [k.lo, k.hi]))
    if (clash) { warnings.push({ span: s.ref, reason: 'overlaps another span without nesting' }); continue }
    kept.push(s)
  }

  // A node's DIRECT children are the maximal kept spans strictly inside it; the gaps between
  // them (and any bare cells) fill with atomic default leaves. Recurse into each group span.
  const build = (lo, hi, pool) => {
    const inside = pool.filter((s) => s.lo >= lo && s.hi <= hi && !(s.lo === lo && s.hi === hi))
    const direct = inside.filter((s) => !inside.some((o) => o !== s && o.lo <= s.lo && s.hi <= o.hi && !(o.lo === s.lo && o.hi === s.hi)))
    direct.sort((a, b) => a.lo - b.lo)
    const children = []
    let cursor = lo
    const fillCells = (from, to) => {
      for (let k = from; k < to; k++) children.push({ lo: k, hi: k + 1, policy: defaultLeaf(k, k + 1, { guides: sorted, cellSize }) })
    }
    for (const s of direct) {
      fillCells(cursor, s.lo)
      const sub = build(s.lo, s.hi, inside)
      children.push({ lo: s.lo, hi: s.hi, policy: s.policy, ...(sub.children ? { children: sub.children } : {}) })
      cursor = s.hi
    }
    fillCells(cursor, hi)
    return { lo, hi, children }
  }

  const root = n >= 2 ? build(0, n - 1, kept) : { lo: 0, hi: Math.max(0, n - 1), children: [] }
  // A span covering the WHOLE axis pins the container itself (the plot on this axis): its
  // policy becomes the root's, rather than being a child of itself. A fixed whole-axis span
  // therefore sizes the plot; its interior spans subdivide it.
  const wholeAxis = kept.find((s) => s.lo === 0 && s.hi === n - 1)
  if (wholeAxis) root.policy = wholeAxis.policy
  return { root, guides: sorted, warnings }
}

// The size a subtree "wants" with no external total: a fixed leaf is its size, a flex leaf is
// its weight (which, for the default policy, equals the cell's current size), a group is the
// sum of its children. Used to grow the plot when an axis (or a group) cannot flex to fit.
export function naturalSize(node) {
  if (isFixed(node.policy)) return node.policy.size // a fixed node wants exactly its size
  if (!node.children || !node.children.length) return node.policy?.weight ?? 0
  return node.children.reduce((t, c) => t + naturalSize(c), 0)
}

// Distribute `size` across a tree, writing `.size` onto every node. Fixed children take their
// size; the leftover is split among flex children by weight (equal split if a group somehow
// has zero total weight). Recurses into groups.
export function distribute(node, size) {
  node.size = size
  const kids = node.children
  if (!kids || !kids.length) return node
  let fixedTotal = 0, weightTotal = 0
  for (const c of kids) { if (isFixed(c.policy)) fixedTotal += c.policy.size; else weightTotal += c.policy.weight }
  const leftover = size - fixedTotal
  for (const c of kids) {
    const cs = isFixed(c.policy)
      ? c.policy.size
      : (weightTotal > 0 ? leftover * (c.policy.weight / weightTotal) : leftover / kids.filter((k) => !isFixed(k.policy)).length)
    distribute(c, cs)
  }
  return node
}

const R6 = (v) => Math.round(Number(v) * 1e6) / 1e6

// Read a distributed tree's atomic cell sizes in guide order and turn them into absolute
// guide positions from `origin`. Returns Map<guideId, position>.
export function positionsOf(tree, origin = 0) {
  const g = tree.guides
  const cell = new Array(Math.max(0, g.length - 1)).fill(0)
  const walk = (node) => {
    if (!node.children || !node.children.length) { if (node.hi === node.lo + 1) cell[node.lo] = node.size; return }
    node.children.forEach(walk)
  }
  walk(tree.root)
  const pos = new Map()
  if (g.length) pos.set(g[0].id, R6(origin))
  let acc = origin
  for (let i = 0; i < cell.length; i++) { acc += cell[i]; pos.set(g[i + 1].id, R6(acc)) }
  return pos
}

// Convenience: build + distribute + read positions for one axis. `total` is the axis length
// (the plot on this axis). When the axis cannot flex to fit `total` (all-fixed, or fixed
// children already exceed it and nothing flexes), it falls back to the natural size so the
// plot grows instead of squashing — the caller gets the used total back to resize the plot.
export function solveAxisSpans(guides, spans, total, origin = 0, opts = {}) {
  const tree = buildAxisTree(guides, spans, opts)
  const natural = naturalSize(tree.root)
  // The axis holds the given plot length only if it can flex to it: the container is not
  // itself pinned (a fixed whole-axis span) AND at least one top-level child is flex. A rigid
  // axis (all fixed, or pinned) uses its natural size so the plot grows/shrinks to fit.
  const canFlex = !isFixed(tree.root.policy) && tree.root.children.some((c) => !isFixed(c.policy))
  const used = canFlex ? Number(total) : natural
  distribute(tree.root, used)
  return { positions: positionsOf(tree, origin), total: R6(used), natural: R6(natural), tree, warnings: tree.warnings }
}
