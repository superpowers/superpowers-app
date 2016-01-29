import * as electron from "electron";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as async from "async";
import * as http from "http";
import { startsWith } from "lodash";

interface ExportData {
  projectId: string; buildId: string;
  baseURL: string; mainPort: string; buildPort: string;
  outputFolder: string; files: string[];
}

electron.ipcMain.on("choose-export-folder", onChooseExportFolder);
electron.ipcMain.on("export", onExport);

function onChooseExportFolder(event: Electron.IPCMainEvent) {
  electron.dialog.showOpenDialog({ properties: ["openDirectory"] }, (directory: string[]) => {
    if (directory == null) return;

    const outputFolder = directory[0];
    let isFolderEmpty = false;
    try { isFolderEmpty = fs.readdirSync(outputFolder).length === 0; }
    catch (e) { event.sender.send("export-folder-failed", `Error while checking if folder was empty: ${e.message}`); return; }
    if (!isFolderEmpty) { event.sender.send("export-folder-failed", "Output folder must be empty."); return; }

    event.sender.send("export-folder-success", outputFolder);
  });
}

function onExport(event: Electron.IPCMainEvent, data: ExportData) {
  const exportWindow = new electron.BrowserWindow({
    title: "Superpowers", icon: `${__dirname}/public/images/icon.png`,
    width: 1000, height: 600,
    minWidth: 800, minHeight: 480
  });
  exportWindow.setMenuBarVisibility(false);
  exportWindow.loadURL(`${data.baseURL}:${data.mainPort}/build.html`);

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
      if (startsWith(outputFilename, buildPath)) {
        // Project build files are served on the build port
        outputFilename = outputFilename.substr(buildPath.length);
        file = `${data.baseURL}:${data.buildPort}${file}`;
      } else {
        // Other files are served on the main port
        file = `${data.baseURL}:${data.mainPort}${file}`;

        if (startsWith(outputFilename, systemsPath)) {
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
}
