const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getChromePath: () => ipcRenderer.invoke("launcher:chrome-path"),
  getDetectedApps: () => ipcRenderer.invoke("launcher:get-detected-apps"),
  browseApp: () => ipcRenderer.invoke("launcher:browse-app"),
  start: (config) => ipcRenderer.invoke("launcher:start", config),
  stop: () => ipcRenderer.invoke("launcher:stop"),
  openUrl: (url) => ipcRenderer.invoke("launcher:open-url", url),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("launcher:progress", listener);
    return () => ipcRenderer.removeListener("launcher:progress", listener);
  }
});