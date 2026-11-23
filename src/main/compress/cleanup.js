import { readdir, rm, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

export function getWorkDir() {
  return join(tmpdir(), 'resizer')
}

/** @type {Set<string>} */
const trackedTemps = new Set()

/**
 * @param {string | null | undefined} filePath
 */
export function trackTemp(filePath) {
  if (filePath) trackedTemps.add(filePath)
}

/**
 * @param {string | null | undefined} filePath
 */
export async function forgetTemp(filePath) {
  if (!filePath) return
  trackedTemps.delete(filePath)
  await safeUnlink(filePath)
}

export async function clearTrackedTemps() {
  const paths = [...trackedTemps]
  trackedTemps.clear()
  await Promise.all(paths.map((p) => safeUnlink(p)))
}

/** Remove every file left in the resizer temp folder. */
export async function clearWorkDir() {
  await clearTrackedTemps()
  const dir = getWorkDir()
  try {
    const entries = await readdir(dir)
    await Promise.all(entries.map((name) => rm(join(dir, name), { force: true, recursive: true })))
  } catch {
    // directory may not exist yet
  }
}

async function safeUnlink(path) {
  try {
    await unlink(path)
  } catch {
    // ignore
  }
}
