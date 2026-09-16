// Live sync to an open Wadi tab in the SAME browser, via a BroadcastChannel — no
// session code, no relay, no copy-paste. The planner and Wadi are served from the same
// origin (…/planner and …/app), so a BroadcastChannel reaches directly between the
// tabs. Wadi listens on the same channel and renders whatever WDL the planner
// broadcasts, so the 3-D model updates live as you sketch.

import { modelToWdl } from './toWadi.js'

const CHANNEL = 'wadi:planner-live'
let chan = null
function channel() {
  if (chan) return chan
  try { chan = new BroadcastChannel(CHANNEL) } catch { chan = null }
  return chan
}

export const liveSupported = () => typeof BroadcastChannel !== 'undefined'

/** Broadcast the model's WDL to any open Wadi tab. Returns false if unsupported. */
export function broadcastModel(model) {
  const ch = channel()
  if (!ch) return false
  try { ch.postMessage({ type: 'wdl', wdl: modelToWdl(model), wadi_version: 2 }); return true } catch { return false }
}

/** Ask whether a Wadi tab is listening; calls cb(true) on ack, cb(false) on timeout. */
export function probeWadi(cb, timeoutMs = 800) {
  const ch = channel()
  if (!ch) { cb(false); return }
  let done = false
  const onMsg = (e) => {
    if (e.data?.type === 'wadi-ack' && !done) { done = true; ch.removeEventListener('message', onMsg); cb(true) }
  }
  ch.addEventListener('message', onMsg)
  try { ch.postMessage({ type: 'planner-hello' }) } catch { /* */ }
  setTimeout(() => { if (!done) { done = true; ch.removeEventListener('message', onMsg); cb(false) } }, timeoutMs)
}
