/// <reference path="../../typings/tsd.d.ts" />

import * as electron from "electron";

let mainWindow: GitHubElectron.BrowserWindow;
let appIcon: GitHubElectron.Tray;
let appIconMenu: GitHubElectron.Menu;

let shouldQuit = electron.app.makeSingleInstance((args, workingDirectory) => {
  restoreMainWindow();
  return true;
});

if (shouldQuit) {
  electron.app.quit();
  process.exit(0);
}

electron.app.on("window-all-closed", () => { /* Nothing */ });

electron.app.on("ready", function() {
  electron.Menu.setApplicationMenu(null);
  setupAppIcon();
  setupMainWindow();
});

function setupAppIcon() {
  appIcon = new electron.Tray(`${__dirname}/icon-16.png`);
  appIcon.setToolTip("Superpowers");
  appIcon.on("double-click", () => { restoreMainWindow(); });
  appIconMenu = electron.Menu.buildFromTemplate([
    { type: "separator" },
    { label: "Dashboard", type: "normal", click: () => { restoreMainWindow(); } },
    { type: "separator" },
    { label: "Exit", type: "normal", click: () => { shouldQuit = true; electron.app.quit(); } }
  ]);
  appIcon.setContextMenu(appIconMenu);
  if (electron.app.dock != null) electron.app.dock.setMenu(appIconMenu);

  // TODO: Insert 5 most recently used servers
  appIconMenu.insert(0, new electron.MenuItem({ label: "My Server", type: "normal", click: () => {} }));
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
