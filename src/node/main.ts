/// <reference path="../../typings/tsd.d.ts" />

import * as electron from "electron";

let mainWindow: GitHubElectron.BrowserWindow;
let appIcon: GitHubElectron.Tray;
let appIconMenu: GitHubElectron.Menu;

let quit = false;

electron.app.on("window-all-closed", () => { /* Nothing */ });

electron.app.on("ready", function() {
  electron.Menu.setApplicationMenu(null);
  setupAppIcon();
  setupMainWindow();
});

function setupAppIcon() {
  appIcon = new electron.Tray(`${__dirname}/icon-16.png`);
  appIcon.setToolTip("Superpowers");
  appIcon.on("double-click", () => { mainWindow.show(); });
  appIconMenu = electron.Menu.buildFromTemplate([
    { type: "separator" },
    { label: "Dashboard", type: "normal", click: () => { mainWindow.show(); } },
    { type: "separator" },
    { label: "Exit", type: "normal", click: () => { quit = true; electron.app.quit(); } }
  ]);
  appIcon.setContextMenu(appIconMenu);

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
    if (quit) return;

    event.preventDefault();
    mainWindow.hide();
  });
}
