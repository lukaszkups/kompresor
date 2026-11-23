# Resizer

Desktop app that shrinks PDF, image, video, and audio files while keeping quality tunable.

Built with Electron, Vite, and JavaScript. Compression runs in the main process:

- **Images** - [sharp](https://sharp.pixelplumbing.com/)
- **PDF** - Ghostscript via [compress-pdf](https://www.npmjs.com/package/compress-pdf)
- **Video / audio** - bundled [ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static)

ffmpeg ships with the app via `ffmpeg-static`. PDF compression needs Ghostscript installed on the system (`gs` on PATH).

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm 9+
- Ghostscript (for PDF only): `sudo apt-get install ghostscript` on Ubuntu, `brew install ghostscript` on macOS

## Setup

```bash
npm install
npm run dev
```

On Linux, the app starts with `--no-sandbox` so Chromium's setuid sandbox helper does not need root ownership of `chrome-sandbox`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Electron + Vite in development |
| `npm run build` | Bundle main, preload, and renderer |
| `npm run build:linux` | Package Linux AppImage / deb |
| `npm run build:mac` | Package macOS app |
| `npm run build:win` | Package Windows installer |

## How it works

1. Drop a file (or click the drop zone to browse).
2. The app detects the type from MIME type and extension.
3. Compression starts automatically with sensible defaults.
4. Adjust the quality sliders to re-compress.
5. Click **Save As** and choose the destination in the system dialog.

If the result is not smaller than the original, the app keeps the original bytes and tells you.

## Sliders by type

| Type | Controls |
| --- | --- |
| Image | Quality 40-100; optional max long-edge width (0 = keep original size) |
| PDF | Preset: Screen / Ebook / Printer / Prepress |
| Video | CRF 18-28 (lower is higher quality); scale 50-100% |
| Audio | Bitrate 64-320 kbps |

## Supported formats

- **PDF** - `.pdf`
- **Images** - `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`, `.bmp`, `.tif`, `.tiff`
- **Video** - `.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`, `.m4v`, and similar
- **Audio** - `.mp3`, `.aac`, `.m4a`, `.wav`, `.flac`, `.ogg`, `.opus`, and similar

Password-protected PDFs are not supported beyond a clear error message.
