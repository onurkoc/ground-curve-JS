/*jshint esversion: 7 */
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { join } = require('path');

app.disableHardwareAcceleration();

let mainWindow;

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-features', 'DirectComposition,DirectCompositionVideoOverlays');
app.commandLine.appendSwitch('use-gl', 'swiftshader');

app.once('ready', () => {
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, '../preload/preload.js'),
        },
        show: false,
        width: 1400,
        height: 900,
        title: 'GroundCurve',
        icon: join(app.getAppPath(), 'assets/icons/win/icon.ico')
    });

    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => app.quit());

    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    Menu.setApplicationMenu(mainMenu);

    mainWindow.once('ready-to-show', () => mainWindow.show());
});

ipcMain.on('value:sliders', function (e, item) {
    var printScreen = new BrowserWindow({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, '../preload/printscreen.js'),
        },
        autoHideMenuBar: true,
        show: false,
        width: 280,
        height: 430,
        title: 'Parameters',
        icon: join(app.getAppPath(), 'assets/icons/win/icon.ico')
    });

    printScreen.loadFile(join(app.getAppPath(), 'printScreen.html'));
    printScreen.once('ready-to-show', () => printScreen.show());
    printScreen.webContents.send('value:sliders', item);
    printScreen.on('close', () => { printScreen = null; });
});

const mainMenuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Quit',
                accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
                click() { app.quit(); }
            }
        ]
    }
];

if (process.env.NODE_ENV !== 'production') {
    mainMenuTemplate.push({
        label: 'Developer Tools',
        submenu: [
            {
                label: 'Toggle DevTools',
                accelerator: process.platform === 'darwin' ? 'Command+I' : 'Ctrl+I',
                click(item, focusedWindow) { focusedWindow.toggleDevTools(); }
            },
            { role: 'Reload', accelerator: process.platform === 'darwin' ? 'Command+R' : 'Ctrl+R' }
        ]
    });
}
