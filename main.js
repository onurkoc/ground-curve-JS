/*jshint esversion: 7 */
const electron = require('electron');
const url = require('url');
const path = require('path');

const { app, BrowserWindow, Menu } = electron;

// Set env production or developer
process.env.NODE_ENV = 'developer';

let mainWindow;

// Listen for the app to be ready
app.on('ready', function () {
    //create a main window
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        //titleBarStyle: 'hidden',
        width: 1650,
        height: 1100,
        title: 'Ground Curve',
        icon: path.join(__dirname, 'assets/icons/win/icon.ico')
    });
    // Load html file into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    // Close all windows on exit
    mainWindow.on('closed', function () {
        app.quit();
    })
    // Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    // Insert menu
    Menu.setApplicationMenu(mainMenu);
});

// Create menu template
const mainMenuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Quit',
                accelerator: process.platform === 'darwin' ? 'Command+Q' :
                    'Ctrl+Q',
                click() {
                    app.quit();
                }
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
                accelerator: process.platform === 'darwin' ? 'Command+I' :
                    'Ctrl+I',
                click(item, focusedWindow) {
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'Reload',
                accelerator: process.platform === 'darwin' ? 'Command+R' :
                    'Ctrl+R'
            }
        ]
    })
}
