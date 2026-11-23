import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { copyFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  clearWorkDir,
  detectKind,
  forgetTemp,
  runCompress
} from './compress/index.js'

// Avoid chrome-sandbox setuid failures on many Linux desktops / containers.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

/** @type {BrowserWindow | null} */
let mainWindow = null

const CONTENT_WIDTH = 720
const MIN_CONTENT_HEIGHT = 420
const MAX_CONTENT_HEIGHT = 900

function createWindow() {
  mainWindow = new BrowserWindow({
    width: CONTENT_WIDTH,
    height: MIN_CONTENT_HEIGHT,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Resizer',
    backgroundColor: '#0f1419',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.lukaszkups.resizer')
  await clearWorkDir()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('dialog:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a file to compress',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media',
          extensions: [
            'pdf',
            'jpg',
            'jpeg',
            'png',
            'webp',
            'avif',
            'gif',
            'bmp',
            'tif',
            'tiff',
            'mp4',
            'mov',
            'mkv',
            'webm',
            'avi',
            'm4v',
            'mp3',
            'aac',
            'm4a',
            'wav',
            'flac',
            'ogg',
            'opus'
          ]
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePaths[0]) {
      return null
    }

    const sourcePath = result.filePaths[0]
    const kind = detectKind(sourcePath)
    return {
      sourcePath,
      name: basename(sourcePath),
      kind
    }
  })

  ipcMain.handle('compress:run', async (event, payload) => {
    const sendProgress = (percent) => {
      event.sender.send('compress:progress', { percent })
    }

    try {
      return await runCompress(payload, sendProgress)
    } catch (error) {
      console.error('compress failed', error)
      throw new Error(error?.message || 'Compression failed')
    }
  })

  ipcMain.handle('dialog:save', async (_event, { tempPath, defaultName }) => {
    if (!tempPath) throw new Error('Nothing to save')

    const ext = extname(defaultName || tempPath).replace('.', '') || '*'
    const result = await dialog.showSaveDialog({
      title: 'Save compressed file',
      defaultPath: defaultName || basename(tempPath),
      filters: [
        { name: 'Compressed file', extensions: [ext] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await copyFile(tempPath, result.filePath)
    await forgetTemp(tempPath)
    return {
      canceled: false,
      filePath: result.filePath,
      directory: dirname(result.filePath)
    }
  })

  ipcMain.handle('file:detect', (_event, { sourcePath, mime }) => {
    return { kind: detectKind(sourcePath, mime) }
  })

  ipcMain.handle('temps:clear', async () => {
    await clearWorkDir()
  })

  ipcMain.handle('window:resizeToContent', (_event, { width, height }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const nextWidth = Math.round(width || CONTENT_WIDTH)
    const nextHeight = Math.round(clamp(height || MIN_CONTENT_HEIGHT, MIN_CONTENT_HEIGHT, MAX_CONTENT_HEIGHT))
    mainWindow.setContentSize(nextWidth, nextHeight)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  clearWorkDir()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
