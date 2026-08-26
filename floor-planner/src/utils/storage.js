const KEY = 'floor-planner:model:v1'

export function saveLocal(model) {
  try {
    localStorage.setItem(KEY, JSON.stringify(model))
  } catch {
    /* ignore quota / private mode errors */
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const model = JSON.parse(raw)
    if (!model || !Array.isArray(model.rooms) || !model.plot || !model.grid) {
      return null
    }
    return model
  } catch {
    return null
  }
}

function download(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportSVG(svgString, filename = 'floor-plan.svg') {
  download(filename, svgString, 'image/svg+xml')
}

// ---- JSON save / load via the File System Access API (with fallback) ----

const supportsFS =
  typeof window !== 'undefined' &&
  typeof window.showSaveFilePicker === 'function' &&
  typeof window.showOpenFilePicker === 'function'

const JSON_TYPES = [
  { description: 'Floor plan JSON', accept: { 'application/json': ['.json'] } },
]

// The File System Access API throws in cross-origin iframes; detect that so we
// fall back to a normal file input (invoked within the same click gesture).
function inIframe() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}
const canUseFS = supportsFS && !inIframe()

// Retained handle for the current file so Save can overwrite it silently.
let currentHandle = null

export function clearFileHandle() {
  currentHandle = null
}

export function currentFileName() {
  return currentHandle ? currentHandle.name : null
}

function validateModel(model) {
  if (!model || !model.rooms || !model.plot || !model.grid || !model.edges) {
    throw new Error('Not a valid floor-plan file')
  }
  return model
}

// Save the model. Overwrites the current file if one is set; otherwise prompts
// once for a location and remembers it. Returns { name } or { aborted:true }.
export async function saveModel(model) {
  const text = JSON.stringify(model, null, 2)
  if (canUseFS) {
    try {
      if (!currentHandle) {
        currentHandle = await window.showSaveFilePicker({
          suggestedName: 'floor-plan.json',
          types: JSON_TYPES,
        })
      }
      const writable = await currentHandle.createWritable()
      await writable.write(text)
      await writable.close()
      return { name: currentHandle.name }
    } catch (e) {
      if (e && e.name === 'AbortError') return { aborted: true }
      // permission or other error -> fall back to a download
    }
  }
  download('floor-plan.json', text, 'application/json')
  return { name: 'floor-plan.json', downloaded: true }
}

// Force a new location even if a file is already associated.
export async function saveModelAs(model) {
  currentHandle = null
  return saveModel(model)
}

// Open a JSON file, remember its handle (so later saves overwrite it), and
// return the parsed model. No type filter is applied to the picker so files are
// never greyed out — the content is validated after reading instead.
export function openModel() {
  if (canUseFS) {
    return window
      .showOpenFilePicker({ multiple: false })
      .then(async ([handle]) => {
        currentHandle = handle
        const file = await handle.getFile()
        return validateModel(JSON.parse(await file.text()))
      })
      .catch((e) => {
        // Don't fall back here — the click gesture is gone by now; surface it.
        if (e && e.name === 'AbortError') throw new Error('No file selected')
        throw e
      })
  }
  return openViaInput()
}

// Fallback for browsers without the File System Access API.
function openViaInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    // No accept filter — some OS/browser combos grey out .json files otherwise.
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)
    const cleanup = () => input.parentNode && input.parentNode.removeChild(input)
    input.addEventListener('change', () => {
      const file = input.files && input.files[0]
      if (!file) {
        cleanup()
        return reject(new Error('No file selected'))
      }
      const reader = new FileReader()
      reader.onload = () => {
        cleanup()
        try {
          resolve(validateModel(JSON.parse(String(reader.result))))
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => {
        cleanup()
        reject(reader.error)
      }
      reader.readAsText(file)
    })
    input.click()
  })
}
