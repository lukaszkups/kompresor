import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  openFile: () => ipcRenderer.invoke('dialog:open'),
  compress: (payload) => ipcRenderer.invoke('compress:run', payload),
  saveAs: (tempPath, defaultName) => ipcRenderer.invoke('dialog:save', { tempPath, defaultName }),
  detect: (sourcePath, mime) => ipcRenderer.invoke('file:detect', { sourcePath, mime }),
  clearTemps: () => ipcRenderer.invoke('temps:clear'),
  resizeToContent: (width, height) => ipcRenderer.invoke('window:resizeToContent', { width, height }),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return null
    }
  },
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('compress:progress', listener)
    return () => ipcRenderer.removeListener('compress:progress', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
