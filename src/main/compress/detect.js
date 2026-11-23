import { extname } from 'path'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tiff', '.tif', '.bmp'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.wmv', '.flv'])
const AUDIO_EXT = new Set(['.mp3', '.aac', '.m4a', '.wav', '.flac', '.ogg', '.opus', '.wma'])
const PDF_EXT = new Set(['.pdf'])

/**
 * @param {string} filePath
 * @param {string} [mime]
 * @returns {'image' | 'pdf' | 'video' | 'audio' | 'unsupported'}
 */
export function detectKind(filePath, mime = '') {
  const type = (mime || '').toLowerCase()
  const ext = extname(filePath).toLowerCase()

  if (type === 'application/pdf' || PDF_EXT.has(ext)) return 'pdf'
  if (type.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image'
  if (type.startsWith('video/') || VIDEO_EXT.has(ext)) return 'video'
  if (type.startsWith('audio/') || AUDIO_EXT.has(ext)) return 'audio'
  return 'unsupported'
}

/**
 * Suggested save filename: name.slim.ext
 * @param {string} originalName
 * @param {string} [outputExt] - including leading dot
 */
export function slimFileName(originalName, outputExt) {
  const base = originalName.replace(/\.[^.]+$/, '') || 'file'
  const ext = outputExt || extname(originalName) || ''
  return `${base}.slim${ext}`
}
