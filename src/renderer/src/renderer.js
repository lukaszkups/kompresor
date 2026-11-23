const app = document.getElementById('app')
const dropzone = document.getElementById('dropzone')
const workspace = document.getElementById('workspace')
const fileNameEl = document.getElementById('fileName')
const fileKindEl = document.getElementById('fileKind')
const originalSizeEl = document.getElementById('originalSize')
const compressedSizeEl = document.getElementById('compressedSize')
const savedAmountEl = document.getElementById('savedAmount')
const statusText = document.getElementById('statusText')
const progress = document.getElementById('progress')
const progressBar = document.getElementById('progressBar')
const controls = document.getElementById('controls')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')

/** @type {{ sourcePath: string, name: string, kind: string, mime?: string } | null} */
let currentFile = null
/** @type {{ tempPath: string, suggestedName: string, originalSize: number, compressedSize: number, keptOriginal: boolean } | null} */
let lastResult = null
let compressToken = 0
let debounceTimer = null
let resizeTimer = null
let unsubscribeProgress = null

const CONTENT_WIDTH = 720

const PDF_PRESETS = {
  1: 'Screen',
  2: 'Ebook',
  3: 'Printer',
  4: 'Prepress'
}

const DEFAULTS = {
  image: { quality: 80, maxWidth: 0 },
  pdf: { quality: 2 },
  video: { crf: 23, scalePercent: 100 },
  audio: { bitrate: 128 }
}

init()

function init() {
  if (!window.api) {
    setStatus('Electron API unavailable. Run this app with npm run dev.', true)
    return
  }

  unsubscribeProgress = window.api.onProgress(({ percent }) => {
    setProgress(percent)
  })

  dropzone.addEventListener('click', () => openFilePicker())
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openFilePicker()
    }
  })

  ;['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault()
      dropzone.classList.add('is-dragover')
    })
  })

  ;['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault()
      if (type === 'dragleave') dropzone.classList.remove('is-dragover')
    })
  })

  dropzone.addEventListener('drop', async (e) => {
    dropzone.classList.remove('is-dragover')
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    await loadDroppedFile(file)
  })

  document.body.addEventListener('dragover', (e) => e.preventDefault())
  document.body.addEventListener('drop', (e) => e.preventDefault())

  saveBtn.addEventListener('click', saveFile)
  resetBtn.addEventListener('click', resetToIdle)

  const resizeObserver = new ResizeObserver(() => scheduleWindowResize())
  resizeObserver.observe(app)
  window.addEventListener('load', () => scheduleWindowResize())
  document.fonts?.ready?.then(() => scheduleWindowResize())
  scheduleWindowResize()
}

function scheduleWindowResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    fitWindowToContent()
  }, 16)
}

function fitWindowToContent() {
  if (!window.api?.resizeToContent) return
  const rect = app.getBoundingClientRect()
  const height = Math.ceil(Math.max(rect.height, app.scrollHeight, document.body.scrollHeight))
  window.api.resizeToContent(CONTENT_WIDTH, height)
}

async function openFilePicker() {
  const picked = await window.api.openFile()
  if (!picked) return
  await loadFile(picked)
}

async function loadDroppedFile(file) {
  const sourcePath = window.api.getPathForFile(file)
  if (!sourcePath) {
    setStatus('Could not read that file path. Try Browse instead.', true)
    scheduleWindowResize()
    return
  }

  const detected = await window.api.detect(sourcePath, file.type)
  await loadFile({
    sourcePath,
    name: file.name,
    kind: detected.kind,
    mime: file.type
  })
}

async function loadFile(fileInfo) {
  if (fileInfo.kind === 'unsupported') {
    setStatus('Unsupported file type. Use PDF, image, video, or audio.', true)
    scheduleWindowResize()
    return
  }

  // Discard any previous compressed output before starting a new file.
  lastResult = null
  await window.api.clearTemps()

  currentFile = fileInfo
  saveBtn.disabled = true

  app.dataset.state = 'working'
  workspace.hidden = false
  fileNameEl.textContent = fileInfo.name
  fileKindEl.textContent = fileInfo.kind
  originalSizeEl.textContent = '-'
  compressedSizeEl.textContent = '-'
  savedAmountEl.textContent = '-'
  setStatus('Compressing...')
  buildControls(fileInfo.kind)
  scheduleWindowResize()
  await runCompression()
}

function buildControls(kind) {
  controls.innerHTML = ''
  const defaults = { ...DEFAULTS[kind] }

  if (kind === 'image') {
    controls.append(
      rangeControl({
        id: 'quality',
        label: 'Quality',
        min: 40,
        max: 100,
        step: 1,
        value: defaults.quality,
        format: (v) => String(v)
      }),
      rangeControl({
        id: 'maxWidth',
        label: 'Max long edge (px)',
        min: 0,
        max: 4000,
        step: 50,
        value: defaults.maxWidth,
        format: (v) => (Number(v) === 0 ? 'Original' : String(v))
      })
    )
  } else if (kind === 'pdf') {
    controls.append(
      rangeControl({
        id: 'quality',
        label: 'PDF preset',
        min: 1,
        max: 4,
        step: 1,
        value: defaults.quality,
        format: (v) => PDF_PRESETS[v] || String(v)
      })
    )
  } else if (kind === 'video') {
    controls.append(
      rangeControl({
        id: 'crf',
        label: 'Quality (CRF, lower = better)',
        min: 18,
        max: 28,
        step: 1,
        value: defaults.crf,
        format: (v) => String(v)
      }),
      rangeControl({
        id: 'scalePercent',
        label: 'Scale',
        min: 50,
        max: 100,
        step: 5,
        value: defaults.scalePercent,
        format: (v) => `${v}%`
      })
    )
  } else if (kind === 'audio') {
    controls.append(
      rangeControl({
        id: 'bitrate',
        label: 'Bitrate',
        min: 64,
        max: 320,
        step: 16,
        value: defaults.bitrate,
        format: (v) => `${v} kbps`
      })
    )
  }

  controls.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener('input', () => {
      const valueEl = controls.querySelector(`[data-for="${input.id}"]`)
      if (valueEl) valueEl.textContent = input.dataset.format ? formatFromDataset(input) : input.value
      scheduleCompress()
    })
  })

  scheduleWindowResize()
}

function rangeControl({ id, label, min, max, step, value, format }) {
  const wrap = document.createElement('div')
  wrap.className = 'control'
  wrap.innerHTML = `
    <div class="control-head">
      <label for="${id}">${label}</label>
      <span class="control-value" data-for="${id}">${format(value)}</span>
    </div>
    <input type="range" id="${id}" name="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
  `
  const input = wrap.querySelector('input')
  input.dataset.format = 'custom'
  input._format = format
  return wrap
}

function formatFromDataset(input) {
  if (typeof input._format === 'function') return input._format(Number(input.value))
  return input.value
}

function readOptions(kind) {
  const get = (id, fallback) => {
    const el = document.getElementById(id)
    return el ? Number(el.value) : fallback
  }

  if (kind === 'image') {
    return { quality: get('quality', 80), maxWidth: get('maxWidth', 0) }
  }
  if (kind === 'pdf') {
    return { quality: get('quality', 2) }
  }
  if (kind === 'video') {
    return { crf: get('crf', 23), scalePercent: get('scalePercent', 100) }
  }
  if (kind === 'audio') {
    return { bitrate: get('bitrate', 128) }
  }
  return {}
}

function scheduleCompress() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    runCompression()
  }, 400)
}

async function runCompression() {
  if (!currentFile) return

  const token = ++compressToken
  app.dataset.state = 'working'
  saveBtn.disabled = true
  showProgress(true)
  setProgress(2)
  setStatus('Compressing...')
  scheduleWindowResize()

  try {
    const result = await window.api.compress({
      sourcePath: currentFile.sourcePath,
      kind: currentFile.kind,
      mime: currentFile.mime,
      options: readOptions(currentFile.kind)
    })

    if (token !== compressToken) return

    lastResult = result
    app.dataset.state = 'ready'
    setProgress(100)
    showProgress(false)

    animateSize(originalSizeEl, formatBytes(result.originalSize))
    animateSize(compressedSizeEl, formatBytes(result.compressedSize))

    const saved = result.originalSize - result.compressedSize
    const pct = result.originalSize ? Math.round((saved / result.originalSize) * 100) : 0
    animateSize(savedAmountEl, saved > 0 ? `${formatBytes(saved)} (${pct}%)` : '0')

    if (result.keptOriginal) {
      setStatus('Already small - kept the original bytes.', false, true)
    } else {
      setStatus('Ready to save.', false, true)
    }

    saveBtn.disabled = false
    scheduleWindowResize()
  } catch (error) {
    if (token !== compressToken) return
    showProgress(false)
    app.dataset.state = 'ready'
    setStatus(error?.message || 'Compression failed', true)
    saveBtn.disabled = true
    scheduleWindowResize()
  }
}

async function saveFile() {
  if (!lastResult?.tempPath) return
  saveBtn.disabled = true
  try {
    const saved = await window.api.saveAs(lastResult.tempPath, lastResult.suggestedName)
    if (saved?.canceled) {
      setStatus('Save canceled.')
      saveBtn.disabled = false
    } else {
      // Temp output is deleted after a successful save - no leftover history.
      lastResult = null
      setStatus(`Saved to ${saved.filePath}`, false, true)
      saveBtn.disabled = true
    }
  } catch (error) {
    setStatus(error?.message || 'Save failed', true)
    saveBtn.disabled = !lastResult
  }
  scheduleWindowResize()
}

async function resetToIdle() {
  compressToken += 1
  clearTimeout(debounceTimer)
  currentFile = null
  lastResult = null
  await window.api.clearTemps()
  workspace.hidden = true
  app.dataset.state = 'idle'
  controls.innerHTML = ''
  saveBtn.disabled = true
  showProgress(false)
  setStatus('')
  scheduleWindowResize()
}

function setStatus(message, isError = false, isOk = false) {
  statusText.textContent = message
  statusText.classList.toggle('is-error', Boolean(isError))
  statusText.classList.toggle('is-ok', Boolean(isOk) && !isError)
}

function showProgress(visible) {
  progress.hidden = !visible
  if (!visible) progressBar.style.width = '0%'
  scheduleWindowResize()
}

function setProgress(percent) {
  progress.hidden = false
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`
}

function animateSize(el, text) {
  el.textContent = text
  el.classList.remove('is-updated')
  void el.offsetWidth
  el.classList.add('is-updated')
  setTimeout(() => el.classList.remove('is-updated'), 500)
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[i]}`
}

window.addEventListener('beforeunload', () => {
  if (typeof unsubscribeProgress === 'function') unsubscribeProgress()
})
