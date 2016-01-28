/// <reference path="../../typings/tsd.d.ts" />

import * as electron from "electron";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as async from "async";
import * as _ from "lodash";
import * as mkdirp from "mkdirp";

let userDataPath: string;
switch (process.platform) {
  case "win32":
    if (process.env.APPDATA != null) userDataPath = path.join(process.env.APPDATA, "Superpowers");
    else {
      electron.dialog.showErrorBox("Error at startup", "Could not find APPDATA environment variable.");
      electron.app.quit();
      process.exit(1);
    }
    break;
  case "darwin":
    if (process.env.HOME != null) userDataPath = path.join(process.env.HOME, "Library", "Superpowers");
    else {
      electron.dialog.showErrorBox("Error at startup", "Could not find HOME environment variable.");
      electron.app.quit();
      process.exit(1);
    }
    break;
  default:
    if (process.env.XDG_DATA_HOME != null) userDataPath = path.join(process.env.XDG_DATA_HOME, "Superpowers");
    else if (process.env.HOME != null) userDataPath = path.join(process.env.HOME, ".local/share", "Superpowers");
    else {
      electron.dialog.showErrorBox("Error at startup", "Could not find neither XDG_DATA_HOME nor HOME environment variables.");
      electron.app.quit();
      process.exit(1);
    }
}
try { fs.mkdirSync(userDataPath); }
catch (e) {
  if (e.code !== "EEXIST") {
    electron.dialog.showErrorBox("Error at startup", `Could not create ${userDataPath} folder`);
    electron.app.quit();
    process.exit(1);
  }
}

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
    width: 1000, height: 600, icon: `${__dirname}/superpowers.ico`,
    useContentSize: true, autoHideMenuBar: true,
    show: false
  });
  mainWindow.loadURL(`file://${__dirname}/renderer/index.html`);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("userDataPath", userDataPath);
    mainWindow.show();

    mainWindow.webContents.openDevTools();
  });

  mainWindow.webContents.on("will-navigate", (event, newURL) => { event.preventDefault(); });

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

const standaloneWindowsById:  { [id: string]: GitHubElectron.BrowserWindow } = {};
electron.ipcMain.on("new-standalone-window", (event, address: string, title: string) => {
  const standaloneWindow = new electron.BrowserWindow({
    title, icon: `${__dirname}/superpowers.ico`,
    width: 1000, height: 600,
    minWidth: 800, minHeight: 480,
    autoHideMenuBar: true
  });

  const windowId = standaloneWindow.id;
  standaloneWindowsById[windowId] = standaloneWindow;

  standaloneWindow.on("closed", () => { delete standaloneWindowsById[windowId]; });
  standaloneWindow.webContents.on("will-navigate", (event: Event) => { event.preventDefault(); });
  standaloneWindow.loadURL(address);
});

electron.ipcMain.on("choose-export-folder", (event: { sender: any }) => {
  electron.dialog.showOpenDialog({ properties: ["openDirectory"] }, (directory: string[]) => {
    if (directory == null) return;

    const outputFolder = directory[0];
    let isFolderEmpty = false;
    try { isFolderEmpty = fs.readdirSync(outputFolder).length === 0; }
    catch (e) { event.sender.send("export-folder-failed", `Error while checking if folder was empty: ${e.message}`); return; }
    if (!isFolderEmpty) { event.sender.send("export-folder-failed", "Output folder must be empty."); return; }

    event.sender.send("export-folder-success", outputFolder);
  });
});

interface ExportData {
  projectId: string; buildId: string;
  address: string; mainPort: string; buildPort: string;
  outputFolder: string; files: string[];
}
electron.ipcMain.on("export", (event: { sender: any }, data: ExportData) => {
  const exportWindow = new electron.BrowserWindow({
    title: "Superpowers", icon: `${__dirname}/public/images/icon.png`,
    width: 1000, height: 600,
    minWidth: 800, minHeight: 480
  });
  exportWindow.setMenuBarVisibility(false);
  exportWindow.loadURL(`${data.address}:${data.mainPort}/build.html`);

  const doExport = () => {
    exportWindow.webContents.removeListener("did-finish-load", doExport);
    exportWindow.webContents.send("setText", { title: "Superpowers — Exporting...", text: "Exporting..." });

    exportWindow.setProgressBar(0);
    let progress = 0;
    const progressMax = data.files.length;
    const buildPath = `/builds/${data.projectId}/${data.buildId}`;
    const systemsPath = "/systems/";

    async.eachLimit(data.files, 10, (file: string, cb: (err: Error) => any) => {

      let outputFilename = file;
      if (_.startsWith(outputFilename, buildPath)) {
        // Project build files are served on the build port
        outputFilename = outputFilename.substr(buildPath.length);
        file = `${data.address}:${data.buildPort}${file}`;
      } else {
        // Other files are served on the main port
        file = `${data.address}:${data.mainPort}${file}`;

        if (_.startsWith(outputFilename, systemsPath)) {
          // Output system files at the root
          outputFilename = outputFilename.substr(outputFilename.indexOf("/", systemsPath.length));
        }
      }
      outputFilename = outputFilename.replace(/\//g, path.sep);

      const outputPath = `${data.outputFolder}${outputFilename}`;
      exportWindow.webContents.send("setText", { text: outputPath });

      http.get(file, (response) => {
        mkdirp(path.dirname(outputPath), (err: Error) => {
          const localFile = fs.createWriteStream(outputPath);
          localFile.on("finish", () => {
            progress++;
            exportWindow.setProgressBar(progress / progressMax);
            cb(null);
          });
          response.pipe(localFile);
        });
      }).on("error", cb);
    } , (err: Error) => {
      exportWindow.setProgressBar(-1);
      if (err != null) { alert(err); return; }
      exportWindow.webContents.send("setText", { title: "Superpowers — Exported", text: "Exported to ", showItemInFolder: { text: data.outputFolder, target: data.outputFolder } } );
    });
  };
  exportWindow.webContents.addListener("did-finish-load", doExport);
});
