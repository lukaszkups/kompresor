import { extname } from 'path'
import sharp from 'sharp'

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ quality?: number, maxWidth?: number }} options
 */
export async function compressImage(inputPath, outputPath, options = {}) {
  const quality = clamp(Math.round(options.quality ?? 80), 40, 100)
  const maxWidth = Math.max(0, Math.round(options.maxWidth ?? 0))
  const ext = extname(inputPath).toLowerCase()

  let pipeline = sharp(inputPath, { animated: false }).rotate()

  if (maxWidth > 0) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxWidth,
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  if (ext === '.png') {
    // Map quality slider to PNG compression effort (0-9)
    const compressionLevel = Math.round(((100 - quality) / 60) * 9)
    await pipeline.png({ compressionLevel: clamp(compressionLevel, 0, 9), palette: quality < 90 }).toFile(outputPath)
    return { outputExt: '.png' }
  }

  if (ext === '.webp') {
    await pipeline.webp({ quality }).toFile(outputPath)
    return { outputExt: '.webp' }
  }

  if (ext === '.avif') {
    await pipeline.avif({ quality }).toFile(outputPath)
    return { outputExt: '.avif' }
  }

  // Default: JPEG (also for gif/bmp/tiff/etc.)
  const outExt = ['.jpg', '.jpeg'].includes(ext) ? ext : '.jpg'
  await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outputPath)
  return { outputExt: outExt }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}
