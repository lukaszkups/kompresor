import { copyFile, mkdir, stat, unlink } from 'fs/promises'
import { basename, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { detectKind, slimFileName } from './detect.js'
import { compressImage } from './image.js'
import { compressPdf } from './pdf.js'
import { compressVideo } from './video.js'
import { compressAudio } from './audio.js'
import { clearTrackedTemps, getWorkDir, trackTemp } from './cleanup.js'

/**
 * @param {{ sourcePath: string, kind?: string, mime?: string, options?: object }} payload
 * @param {(percent: number) => void} [onProgress]
 */
export async function runCompress(payload, onProgress) {
  const { sourcePath, mime, options = {} } = payload
  if (!sourcePath) throw new Error('Missing source path')

  const kind = payload.kind || detectKind(sourcePath, mime)
  if (kind === 'unsupported') {
    throw new Error('Unsupported file type. Drop a PDF, image, video, or audio file.')
  }

  // Drop any previous compressed outputs before creating a new one.
  await clearTrackedTemps()

  const originalStat = await stat(sourcePath)
  const originalSize = originalStat.size
  const workDir = getWorkDir()
  await mkdir(workDir, { recursive: true })

  const id = randomUUID()
  const staging = join(workDir, `${id}-in${extname(sourcePath)}`)
  const tentativeOut = join(workDir, `${id}-out.tmp`)

  await copyFile(sourcePath, staging)

  const report = (p) => {
    if (typeof onProgress === 'function') onProgress(p)
  }

  report(5)

  let result
  try {
    switch (kind) {
      case 'image':
        result = await compressImage(staging, tentativeOut, options)
        break
      case 'pdf':
        result = await compressPdf(staging, tentativeOut, options)
        break
      case 'video':
        result = await compressVideo(staging, tentativeOut, options, report)
        break
      case 'audio':
        result = await compressAudio(staging, tentativeOut, options, report)
        break
      default:
        throw new Error(`Unsupported kind: ${kind}`)
    }
  } catch (err) {
    await safeUnlink(staging)
    await safeUnlink(tentativeOut)
    throw err
  }

  report(95)

  const compressedStat = await stat(tentativeOut)
  let finalPath = tentativeOut
  let finalSize = compressedStat.size
  let keptOriginal = false

  const originalExt = extname(sourcePath)
  const outputExt = result.outputExt || originalExt

  if (finalSize >= originalSize) {
    // Keep the smaller original by copying it as the "result"
    const originalCopy = join(workDir, `${id}-original${originalExt}`)
    await copyFile(staging, originalCopy)
    await safeUnlink(tentativeOut)
    finalPath = originalCopy
    finalSize = originalSize
    keptOriginal = true
  } else {
    // Rename to include real extension for Save As filters
    const named = join(workDir, `${id}-out${outputExt}`)
    await copyFile(tentativeOut, named)
    await safeUnlink(tentativeOut)
    finalPath = named
  }

  await safeUnlink(staging)
  trackTemp(finalPath)
  report(100)

  const originalName = basename(sourcePath)
  return {
    kind,
    originalSize,
    compressedSize: finalSize,
    keptOriginal,
    tempPath: finalPath,
    suggestedName: slimFileName(originalName, keptOriginal ? originalExt : outputExt),
    preset: result.preset || null
  }
}

export { detectKind, slimFileName }
export { clearTrackedTemps, clearWorkDir, forgetTemp } from './cleanup.js'

async function safeUnlink(path) {
  try {
    await unlink(path)
  } catch {
    // ignore
  }
}
