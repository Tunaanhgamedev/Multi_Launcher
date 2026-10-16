const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getChromePath: () => ipcRenderer.invoke("launcher:chrome-path"),
  getDetectedApps: () => ipcRenderer.invoke("launcher:get-detected-apps"),
  refreshApps: () => ipcRenderer.invoke("launcher:refresh-apps"),
  browseApp: () => ipcRenderer.invoke("launcher:browse-app"),
  start: (config) => ipcRenderer.invoke("launcher:start", config),
  stop: () => ipcRenderer.invoke("launcher:stop"),
  openUrl: (url) => ipcRenderer.invoke("launcher:open-url", url),
  arrangeWindows: (pattern, layout) => ipcRenderer.invoke("launcher:arrange-windows", pattern, layout),
  closeTargetWindows: (pattern) => ipcRenderer.invoke("launcher:close-target-windows", pattern),
  openProfilesFolder: () => ipcRenderer.invoke("launcher:open-profiles-folder"),
  readClipboard: () => ipcRenderer.invoke("launcher:read-clipboard"),
  toggleMouseSync: (pattern) => ipcRenderer.invoke("launcher:toggle-mouse-sync", pattern),
  getMouseSyncStatus: () => ipcRenderer.invoke("launcher:get-mouse-sync-status"),
  setMouseSyncPattern: (pattern) => ipcRenderer.invoke("launcher:set-mouse-sync-pattern", pattern),
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke("launcher:toggle-always-on-top", flag),
  getAlwaysOnTop: () => ipcRenderer.invoke("launcher:get-always-on-top"),
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