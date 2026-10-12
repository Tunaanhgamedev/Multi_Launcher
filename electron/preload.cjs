const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getChromePath: () => ipcRenderer.invoke("launcher:chrome-path"),
  getDetectedApps: () => ipcRenderer.invoke("launcher:get-detected-apps"),
  browseApp: () => ipcRenderer.invoke("launcher:browse-app"),
  start: (config) => ipcRenderer.invoke("launcher:start", config),
  stop: () => ipcRenderer.invoke("launcher:stop"),
  openUrl: (url) => ipcRenderer.invoke("launcher:open-url", url),
  arrangeWindows: (pattern) => ipcRenderer.invoke("launcher:arrange-windows", pattern),
  toggleMouseSync: (pattern) => ipcRenderer.invoke("launcher:toggle-mouse-sync", pattern),
  getMouseSyncStatus: () => ipcRenderer.invoke("launcher:get-mouse-sync-status"),
  onMouseSyncStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("launcher:sync-status", listener);
    return () => ipcRenderer.removeListener("launcher:sync-status", listener);
  },
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("launcher:progress", listener);
    return () => ipcRenderer.removeListener("launcher:progress", listener);
  }
});