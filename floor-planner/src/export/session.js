// Live push to a Wadi co-edit session. The Wadi viewer connects to a session on the
// relay (mcp.wadi.house) and re-renders whatever WDL is pushed to it — the same
// channel an AI agent uses. So the planner can push its generated WDL to a session
// the viewer is watching, and the 3-D model updates live.
//
// Flow: in the Wadi app, start a live co-edit session and copy its code. Paste it
// here, and every "Push to Wadi" POSTs the current design's WDL to that session.

import { modelToWdl } from './toWadi.js'

// The relay origin: the hosted server by default, overridden ONLY by a `?mcp=<origin>`
// query param — mirroring the viewer's MCP_ORIGIN so both point at the same relay
// (e.g. a local dev server for testing).
export function sessionOrigin() {
  try {
    const v = new URLSearchParams(location.search).get('mcp')
    if (v) return v.trim().replace(/\/$/, '')
  } catch { /* no location */ }
  return 'https://mcp.wadi.house'
}

const CODE_KEY = 'wadi:planner:session'

export function getSessionCode() {
  try { return localStorage.getItem(CODE_KEY) || '' } catch { return '' }
}
export function setSessionCode(code) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code)
    else localStorage.removeItem(CODE_KEY)
  } catch { /* ignore */ }
}

/** Generate the WDL for `model` and POST it to the session so the connected viewer
 *  renders it. Returns { ok, clients, wdl } or throws with a readable message. */
export async function pushModelToSession(model, code, origin = sessionOrigin()) {
  const c = String(code || '').trim()
  if (!c) throw new Error('Enter the session code from the Wadi app first.')
  const wdl = modelToWdl(model)
  let res
  try {
    res = await fetch(`${origin}/session/${encodeURIComponent(c)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wdl }),
    })
  } catch (e) {
    throw new Error(`Couldn't reach the session relay (${origin}). Is the Wadi app's live session running? ${e.message || e}`)
  }
  if (!res.ok) throw new Error(`Relay returned ${res.status}. Check the session code.`)
  const info = await res.json().catch(() => ({}))
  return { ok: true, clients: info.clients ?? 0, wdl }
}
