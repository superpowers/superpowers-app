import * as electron from "electron";
import * as path from "path";

const authorizationsByOrigin: { [origin: string]: { folders: string[]; files: string[] } } = {};
function getAuthorizationsForOrigin(origin: string) {
  let authorizations = authorizationsByOrigin[origin];
  if (authorizations == null) authorizations = authorizationsByOrigin[origin] = { folders: [], files: [] };

  return authorizations;
}

electron.ipcMain.on("choose-folder", onChooseFolder);
electron.ipcMain.on("choose-file", onChooseFile);
electron.ipcMain.on("check-path-authorization", onCheckPathAuthorization);

function onChooseFolder(event: Electron.IpcMainEvent, ipcId: string, origin: string) {
  electron.dialog.showOpenDialog({ properties: [ "openDirectory" ] }, (directory: string[]) => {
    if (directory == null) { event.sender.send("choose-folder-callback", ipcId, null, null); return; }

    const normalizedPath = path.normalize(directory[0]);
    getAuthorizationsForOrigin(origin).folders.push(normalizedPath);

    event.sender.send("choose-folder-callback", ipcId, null, normalizedPath);
  });
}

function onChooseFile(event: Electron.IpcMainEvent, ipcId: string, origin: string) {
  electron.dialog.showOpenDialog({ properties: [ "openFile" ] }, (file: string[]) => {
    if (file == null) { event.sender.send("choose-file-callback", ipcId, null, null); return; }

    const normalizedPath = path.normalize(file[0]);
    getAuthorizationsForOrigin(origin).files.push(normalizedPath);

    event.sender.send("choose-file-callback", ipcId, null, normalizedPath);
  });
}

function onCheckPathAuthorization(event: Electron.IpcMainEvent, ipcId: string, origin: string, pathToCheck: string) {
  const normalizedPath = path.normalize(pathToCheck);

  const authorizations = getAuthorizationsForOrigin(origin);

  let isPathAuthorized = authorizations.files.indexOf(normalizedPath) !== -1;
  if (!isPathAuthorized) {
    for (const authorizedFolderPath of authorizations.folders) {
      if (normalizedPath.indexOf(authorizedFolderPath + path.sep) === 0) {
        isPathAuthorized = true;
        break;
      }
    }
  }

  event.sender.send("check-path-authorization-callback", ipcId, normalizedPath, isPathAuthorized);
}
