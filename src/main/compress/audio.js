import { createRequire } from 'module'
import { extname } from 'path'
import ffmpeg from 'fluent-ffmpeg'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static')

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ bitrate?: number }} options
 * @param {(percent: number) => void} [onProgress]
 */
export function compressAudio(inputPath, outputPath, options = {}, onProgress) {
  const bitrate = clamp(Math.round(options.bitrate ?? 128), 64, 320)
  const ext = extname(inputPath).toLowerCase()
  const { codec, format, outExt } = pickAudioTarget(ext)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec(codec)
      .audioBitrate(`${bitrate}k`)
      .noVideo()
      .format(format)
      .on('progress', (progress) => {
        if (typeof onProgress === 'function' && progress.percent != null) {
          onProgress(Math.min(99, Math.max(0, progress.percent)))
        }
      })
      .on('error', reject)
      .on('end', () => resolve({ outputExt: outExt }))
      .save(outputPath)
  })
}

function pickAudioTarget(ext) {
  if (ext === '.mp3') return { codec: 'libmp3lame', format: 'mp3', outExt: '.mp3' }
  if (ext === '.ogg' || ext === '.opus') return { codec: 'libopus', format: 'ogg', outExt: '.ogg' }
  // Default AAC in m4a (also for wav/flac/wma/m4a/aac)
  return { codec: 'aac', format: 'ipod', outExt: '.m4a' }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}
