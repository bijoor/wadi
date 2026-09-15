// Room-type helpers for the planner. The placement ENGINE that used to live here (pick a
// furniture layout for a typed room and place its pieces) is gone — furniture is now produced
// by wadi's own engine (editor/src/furniture/furnish.ts via toWadi's modelToWadi for the
// export + preview). Only the room-type list for the Sidebar picker remains.

import { libraryLayouts } from '../store/layoutLibrary.js'

const TYPE_LABEL = { bedroom: 'Bedroom', living: 'Living', dining: 'Dining', kitchen: 'Kitchen', bath: 'Bathroom', study: 'Study' }
const label = (t) => TYPE_LABEL[t] || (t.charAt(0).toUpperCase() + t.slice(1))

// The room-type options for the picker: plain room + one per type the library defines (dynamic,
// so a new type authored in the layout editor shows up here).
export function roomTypes() {
  const types = [...new Set(libraryLayouts().map((l) => l.type))]
  return [['', 'Plain room'], ...types.map((t) => [t, label(t)])]
}
