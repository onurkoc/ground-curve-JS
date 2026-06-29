const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onSliderValues: (callback) => ipcRenderer.on('value:sliders', (_event, item) => callback(item)),
});
