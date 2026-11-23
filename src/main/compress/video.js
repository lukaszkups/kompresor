import { createRequire } from 'module'
import ffmpeg from 'fluent-ffmpeg'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static')

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ crf?: number, scalePercent?: number }} options
 * @param {(percent: number) => void} [onProgress]
 */
export function compressVideo(inputPath, outputPath, options = {}, onProgress) {
  const crf = clamp(Math.round(options.crf ?? 23), 18, 28)
  const scalePercent = clamp(Math.round(options.scalePercent ?? 100), 50, 100)

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-crf ${crf}`,
        '-preset medium',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-b:a 128k'
      ])
      .format('mp4')
      .on('progress', (progress) => {
        if (typeof onProgress === 'function' && progress.percent != null) {
          onProgress(Math.min(99, Math.max(0, progress.percent)))
        }
      })
      .on('error', reject)
      .on('end', () => resolve({ outputExt: '.mp4' }))

    if (scalePercent < 100) {
      const factor = (scalePercent / 100).toFixed(4)
      command = command.videoFilters(`scale=iw*${factor}:ih*${factor}`)
    }

    command.save(outputPath)
  })
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}
