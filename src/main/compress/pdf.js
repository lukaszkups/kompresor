import { writeFile } from 'fs/promises'
import { compress } from 'compress-pdf'

const PRESETS = ['screen', 'ebook', 'printer', 'prepress']

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ quality?: number }} options - 1..4 mapped to Ghostscript presets
 */
export async function compressPdf(inputPath, outputPath, options = {}) {
  const level = clamp(Math.round(options.quality ?? 2), 1, 4)
  const resolution = PRESETS[level - 1]

  const buffer = await compress(inputPath, { resolution })
  await writeFile(outputPath, buffer)

  return { outputExt: '.pdf', preset: resolution }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}
