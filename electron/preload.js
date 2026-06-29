const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printScreen: (values) => ipcRenderer.send('value:sliders', values),
});
