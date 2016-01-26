/// <reference path="../../typings/tsd.d.ts" />

import * as electron from "electron";

let mainWindow: GitHubElectron.BrowserWindow;
let trayIcon: GitHubElectron.Tray;
let trayMenu: GitHubElectron.Menu;

let shouldQuit = electron.app.makeSingleInstance((args, workingDirectory) => {
  restoreMainWindow();
  return true;
});

if (shouldQuit) {
  electron.app.quit();
  process.exit(0);
}

electron.app.on("before-quit", () => { shouldQuit = true;  });
electron.app.on("activate", () => { restoreMainWindow(); });

electron.app.on("ready", function() {
  electron.Menu.setApplicationMenu(null);
  setupTrayOrDock();
  setupMainWindow();
});

function setupTrayOrDock() {
  trayMenu = electron.Menu.buildFromTemplate([
    { type: "separator" },
    { label: "Dashboard", type: "normal", click: () => { restoreMainWindow(); } },
    { type: "separator" },
    { label: "Exit", type: "normal", click: () => { shouldQuit = true; electron.app.quit(); } }
  ]);

  // TODO: Insert 5 most recently used servers
  trayMenu.insert(0, new electron.MenuItem({ label: "My Server", type: "normal", click: () => {} }));
  
  if (process.platform !== "darwin") {
    trayIcon = new electron.Tray(`${__dirname}/icon-16.png`);
    trayIcon.setToolTip("Superpowers");
    trayIcon.setContextMenu(trayMenu);
    trayIcon.on("double-click", () => { restoreMainWindow(); });
  } else {
    electron.app.dock.setMenu(trayMenu);
  }
}

function setupMainWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1000, height: 600,
    useContentSize: true, autoHideMenuBar: true,
    show: false
  });
  mainWindow.loadURL(`file://${__dirname}/renderer/index.html`);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.openDevTools();
    mainWindow.show();
  });

  mainWindow.webContents.on("will-navigate", (event) => { event.preventDefault(); });

  mainWindow.on("close", (event) => {
    if (shouldQuit) return;

    event.preventDefault();
    mainWindow.hide();
  });
}

function restoreMainWindow() {
  if (mainWindow == null) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}
