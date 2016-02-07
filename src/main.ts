import * as electron from "electron";
import * as fs from "fs";
import * as i18n from "./shared/i18n";
import getUserData from "./getUserData";
import "./export";

let userDataPath: string;
let mainWindow: Electron.BrowserWindow;
let trayIcon: Electron.Tray;
let trayMenu: Electron.Menu;
const standaloneWindowsById: { [id: string]: Electron.BrowserWindow } = {};

let shouldQuit = electron.app.makeSingleInstance((args, workingDirectory) => {
  restoreMainWindow();
  return true;
});

if (shouldQuit) {
  electron.app.quit();
  process.exit(0);
}

electron.app.on("ready", onAppReady);
electron.app.on("activate", () => { restoreMainWindow(); });
electron.app.on("before-quit", () => { shouldQuit = true;  });

electron.ipcMain.on("new-standalone-window", onNewStandaloneWindow);

function onAppReady() {
  electron.Menu.setApplicationMenu(null);

  getUserData((dataPathErr, dataPath, languageCode) => {
    if (languageCode == null) languageCode = electron.app.getLocale();
    if (i18n.languageIds.indexOf(languageCode) === -1 && languageCode.indexOf("-") !== -1) languageCode = languageCode.split("-")[0];
    if (i18n.languageIds.indexOf(languageCode) === -1) languageCode = "en";

    i18n.languageCode = languageCode;
    i18n.load([ "startup", "tray" ], () => {
      if (dataPathErr != null) {
        electron.dialog.showErrorBox(i18n.t("startup:failed"), i18n.t(dataPathErr.key, dataPathErr.variables));
        electron.app.quit();
        process.exit(1);
        return;
      }

      userDataPath = dataPath;
      setupTrayOrDock();
      setupMainWindow();
    });
  });
}

function setupTrayOrDock() {
  trayMenu = electron.Menu.buildFromTemplate([
    { label: i18n.t("tray:dashboard"), type: "normal", click: () => { restoreMainWindow(); } },
    { type: "separator" },
    { label: i18n.t("tray:exit"), type: "normal", click: () => { shouldQuit = true; electron.app.quit(); } }
  ]);

  // TODO: Insert 5 most recently used servers
  // trayMenu.insert(0, new electron.MenuItem({ type: "separator" }));
  // trayMenu.insert(0, new electron.MenuItem({ label: "My Server", type: "normal", click: () => {} }));

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
    width: 1000, height: 600, icon: `${__dirname}/superpowers.ico`,
    useContentSize: true, autoHideMenuBar: true,
    show: false
  });
  mainWindow.loadURL(`file://${__dirname}/renderer/${i18n.getLocalizedFilename("index.html")}`);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("init", userDataPath, i18n.languageCode);
    mainWindow.show();

    mainWindow.webContents.openDevTools();
  });

  mainWindow.webContents.on("will-navigate", (event: Event, newURL: string) => { event.preventDefault(); });

  mainWindow.on("close", (event: Event) => {
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

function onNewStandaloneWindow(event: Electron.IPCMainEvent, url: string, title: string) {
  const standaloneWindow = new electron.BrowserWindow({
    title, icon: `${__dirname}/superpowers.ico`,
    width: 1000, height: 600,
    minWidth: 800, minHeight: 480,
    useContentSize: true, autoHideMenuBar: true
  });

  const windowId = standaloneWindow.id;
  standaloneWindowsById[windowId] = standaloneWindow;

  standaloneWindow.on("closed", () => { delete standaloneWindowsById[windowId]; });
  standaloneWindow.webContents.on("will-navigate", (event: Event) => { event.preventDefault(); });
  standaloneWindow.loadURL(url);
}
