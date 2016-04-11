import * as electron from "electron";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as async from "async";
import * as http from "http";
import { startsWith } from "lodash";

export interface PublishOptions {
  projectId: string; buildId: string;
  baseURL: string; mainPort: number; buildPort: number;
  outputFolder: string; files: string[];
}

electron.ipcMain.on("choose-folder", onChooseFolder);
electron.ipcMain.on("publish-project", onPublishProject);

function onChooseFolder(event: Electron.IpcMainEvent) {
  electron.dialog.showOpenDialog({ properties: [ "openDirectory" ] }, (directory: string[]) => {
    if (directory == null) { event.sender.send("choose-folder-callback", null, null); return; }

    const outputFolder = directory[0];
    let isFolderEmpty = false;
    try { isFolderEmpty = fs.readdirSync(outputFolder).length === 0; }
    catch (e) { event.sender.send("choose-folder-callback", `Error while checking if folder is empty: ${e.message}`, null); return; }
    if (!isFolderEmpty) { event.sender.send("choose-folder-callback", "Folder must be empty.", null); return; }

    event.sender.send("choose-folder-callback", null, outputFolder);
  });
}

function onPublishProject(event: Electron.IpcMainEvent, options: PublishOptions) {
  const exportWindow = new electron.BrowserWindow({
    title: "Superpowers", icon: `${__dirname}/public/images/icon.png`,
    width: 1000, height: 600, minWidth: 800, minHeight: 480, useContentSize: true,
    webPreferences: { nodeIntegration: false, preload: `${__dirname}/SupApp/index.js` }
  });

  exportWindow.setMenuBarVisibility(false);
  exportWindow.loadURL(`${options.baseURL}:${options.mainPort}/build.html`);
  exportWindow.webContents.addListener("did-finish-load", startExport);

  function startExport() {
    exportWindow.webContents.removeListener("did-finish-load", startExport);
    exportWindow.webContents.send("set-export-status", { title: "Superpowers — Exporting...", text: "Exporting..." });

    let isFolderEmpty = false;
    try { isFolderEmpty = fs.readdirSync(options.outputFolder).length === 0; }
    catch (e) { exportWindow.webContents.send("set-export-status", { text: `Error while checking if output folder is empty: ${e.message}` }); return; }
    if (!isFolderEmpty) { exportWindow.webContents.send("set-export-status", { text: "Output folder must be empty." }); return; }

    exportWindow.setProgressBar(0);
    let progress = 0;
    const progressMax = options.files.length;
    const buildPath = `/builds/${options.projectId}/${options.buildId}`;
    const systemsPath = "/systems/";

    async.eachLimit(options.files, 10, processFile, onExportFinished);

    function processFile(file: string, cb: (err: Error) => any) {
      let outputFilename = file;
      if (startsWith(outputFilename, buildPath)) {
        // Project build files are served on the build port
        outputFilename = outputFilename.substr(buildPath.length);
        file = `${options.baseURL}:${options.buildPort}${file}`;
      } else {
        // Other files are served on the main port
        file = `${options.baseURL}:${options.mainPort}${file}`;

        if (startsWith(outputFilename, systemsPath)) {
          // Output system files at the root
          outputFilename = outputFilename.substr(outputFilename.indexOf("/", systemsPath.length));
        }
      }
      outputFilename = outputFilename.replace(/\//g, path.sep);

      const outputPath = `${options.outputFolder}${outputFilename}`;
      exportWindow.webContents.send("set-export-status", { text: outputPath });

      http.get(file, (response) => {
        mkdirp(path.dirname(outputPath), (err: Error) => {
          const localFile = fs.createWriteStream(outputPath);
          localFile.on("finish", () => { progress++; exportWindow.setProgressBar(progress / progressMax); cb(null); });
          response.pipe(localFile);
        });
      }).on("error", cb);
    }
  }

  function onExportFinished(err: Error) {
    exportWindow.setProgressBar(-1);
    if (err != null) { alert(err); return; }
    exportWindow.webContents.send("set-export-status", {
      title: "Superpowers — Exported",
      text: "Exported to ",
      showItemInFolder: { text: options.outputFolder, target: options.outputFolder }
    });
  }
}
