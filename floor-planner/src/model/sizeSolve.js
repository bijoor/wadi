// Per-axis size solver for room-size variables (see plans/room-size-variables.md).
//
// The configurable layer binds NAMED VARIABLES to room dimensions. Changing a variable
// must re-flow the plan while keeping the PLOT FIXED. X and Y are independent (rooms are
// axis-aligned rectangles), so this is two small 1-D problems over the guide-line
// positions on each axis:
//
//   unknowns  : guide positions g0..gN (the two plot-boundary nodes are pinned)
//   hard eqs  : plot ends pinned; each bound dimension pins its two lines gj - gi = value
//               (a variable shared by k dimensions contributes k such equalities)
//   objective : keep every span close to its current size, weighted so the change spreads
//               PROPORTIONALLY across unpinned spans and FREE space absorbs it first
//
// This is an equality-constrained least squares (a small KKT linear system). Because it is
// LINEAR in the variable values, every guide position comes out as a linear formula in the
// variables ( at = const + Σ coef·value ), which is exactly what the configurator export
// needs. `solveAxis` returns both the solved positions and that per-line formula.

const EPS = 1e-6
const FREE_WEIGHT = 0.05 // free-space spans are ~20x more willing to change (absorb first)

// --- tiny dense linear algebra (systems here are small: #nodes + #constraints) --------

// Solve A x = b in place by Gaussian elimination with partial pivoting. Returns x, or
// null if A is singular (inconsistent / rank-deficient constraints).
function linSolve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-12) return null
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row) => row[n])
}

/**
 * Solve one axis.
 * @param {number} length         plot extent on this axis (FIXED)
 * @param {{id:string, at:number}[]} guides  guide lines on this axis
 * @param {{lo:string, hi:string, varName:string, value:number}[]} bindings
 *        each binding pins gj-gi to a variable's current value; lo/hi are guide ids
 * @param {[number,number][]} [roomSpans]  room extents on this axis (for free-space detection)
 * @param {number} [origin]       plot origin on this axis (default 0)
 * @param {{pinFar?: boolean}} [opts]  pinFar (default true) pins BOTH plot edges (fixed
 *        plot). false pins only the origin, letting the far edge float — the plot resizes
 *        to fit the rooms (elastic mode) while unbound spans keep their size.
 * @returns {{
 *   at: Map<string,number>,                         // solved position per guide id
 *   formula: Map<string,{const:number, coef:Record<string,number>}>,
 *   feasible: boolean, message?: string,
 * }}
 */
export function solveAxis(length, guides, bindings = [], roomSpans = [], origin = 0, opts = {}) {
  const pinFar = opts.pinFar !== false
  const lo = origin
  const hi = origin + length

  // 1) nodes = guides + the pinned plot-boundary node(s). pinFar also pins the far edge
  // (reusing a guide sitting on an end); otherwise only the origin is pinned.
  const nodes = (guides || []).map((g) => ({ id: g.id, at: Number(g.at) }))
  const at0 = nodes.find((n) => Math.abs(n.at - lo) < EPS)
  const at1 = pinFar ? nodes.find((n) => Math.abs(n.at - hi) < EPS) : null
  const loId = at0 ? at0.id : '__lo__'
  const hiId = at1 ? at1.id : '__hi__'
  if (!at0) nodes.push({ id: loId, at: lo })
  if (pinFar && !at1) nodes.push({ id: hiId, at: hi })
  nodes.sort((a, b) => a.at - b.at)

  const N = nodes.length
  const idx = new Map(nodes.map((n, i) => [n.id, i]))
  const g0 = nodes.map((n) => n.at) // current positions

  // 2) span weights: proportional (1/span), free-space spans down-weighted so they absorb first
  const covered = (a, b) =>
    (roomSpans || []).some(([ra, rb]) => ra <= a + EPS && rb >= b - EPS)
  const w = new Array(N - 1)
  for (let k = 0; k < N - 1; k++) {
    const s = Math.max(g0[k + 1] - g0[k], EPS)
    const base = covered(g0[k], g0[k + 1]) ? 1 : FREE_WEIGHT
    w[k] = base / s
  }

  // 3) objective H = Dᵀ W D  (D = adjacent-difference operator), RHS0 = H·g0
  const H = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let k = 0; k < N - 1; k++) {
    const a = k, b = k + 1, wk = w[k]
    H[a][a] += wk; H[b][b] += wk; H[a][b] -= wk; H[b][a] -= wk
  }
  const rhs0 = new Array(N).fill(0)
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) rhs0[r] += H[r][c] * g0[c]

  // 4) constraints A·g = b : boundary row(s) + the binding constraints
  const rows = [] // { coef:number[], rhsConst:number, rhsVar:{[name]:1} }
  const eRow = (map, rhsConst, rhsVar) => {
    const coef = new Array(N).fill(0)
    for (const [i, v] of map) coef[i] += v // accumulate: a link may touch a node twice
    rows.push({ coef, rhsConst, rhsVar })
  }
  eRow([[idx.get(loId), 1]], lo, {})
  if (pinFar) eRow([[idx.get(hiId), 1]], hi, {})

  // Every bound dimension pins its span to the variable's value. With the far plot edge
  // floating (elastic), this is exactly cumulative evaluation: the plot is the sum of the
  // spans and grows with the variables. Interior lines a dimension crosses are placed
  // proportionally by the objective.
  for (const bd of bindings) {
    const i = idx.get(bd.lo), j = idx.get(bd.hi)
    if (i == null || j == null) continue
    eRow([[j, 1], [i, -1]], Number(bd.value), {})
  }
  const C = rows.length

  // 5) KKT  [[H, Aᵀ],[A, 0]] [g; λ] = [rhs0; b]
  const K = N + C
  const KKT = Array.from({ length: K }, () => new Array(K).fill(0))
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) KKT[r][c] = H[r][c]
  rows.forEach((row, ri) => {
    for (let c = 0; c < N; c++) {
      KKT[N + ri][c] = row.coef[c]
      KKT[c][N + ri] = row.coef[c]
    }
  })

  const solveWith = (bvec) => {
    const x = linSolve(KKT, [...rhs0, ...bvec])
    return x ? x.slice(0, N) : null
  }

  // solved positions (each pin's value is baked into rhsConst)
  const bCur = rows.map((row) => row.rhsConst)
  const gCur = solveWith(bCur)
  if (!gCur) return fail('over-constrained: guide constraints are inconsistent')

  // 6) assemble output positions per guide id; feasibility = no negative span
  const at = new Map()
  const formula = new Map()
  for (let i = 0; i < N; i++) {
    const id = nodes[i].id
    if (id === '__lo__' || id === '__hi__') continue
    at.set(id, round(gCur[i]))
  }
  let feasible = true, message
  for (let k = 0; k < N - 1; k++) {
    if (gCur[k + 1] - gCur[k] < -1e-4) { feasible = false; message = 'a span is driven negative (over-constrained)'; break }
  }
  return { at, formula, feasible, message }

  function fail(msg) { return { at: new Map(), formula: new Map(), feasible: false, message: msg } }
}

const round = (v) => Math.round(Number(v) * 1e6) / 1e6
