import * as electron from "electron";
import * as fs from "fs";
import * as path from "path";

let authorizationsByOrigin: { [origin: string]: { folders: string[]; rwFiles: string[], exeFiles: string[] } } = {};

export function loadAuthorizations(dataPath: string) {
  try {
    const authorizationsByOriginJSON = fs.readFileSync(`${dataPath}/authorizationsByOrigin.json`, { encoding: "utf8" });
    authorizationsByOrigin = JSON.parse(authorizationsByOriginJSON);
    if (authorizationsByOrigin == null || typeof authorizationsByOrigin !== "object") authorizationsByOrigin = {};
  } catch (err) {
    // Ignore
  }
}

export function saveAuthorizations(dataPath: string) {
  fs.writeFileSync(`${dataPath}/authorizationsByOrigin.json`, JSON.stringify(authorizationsByOrigin, null, 2));
}

function getAuthorizationsForOrigin(origin: string) {
  let authorizations = authorizationsByOrigin[origin];
  if (authorizations == null) authorizations = authorizationsByOrigin[origin] = { folders: [], rwFiles: [], exeFiles: [] };

  return authorizations;
}

electron.ipcMain.on("setup-key", onSetupKey);
electron.ipcMain.on("choose-folder", onChooseFolder);
electron.ipcMain.on("choose-file", onChooseFile);
electron.ipcMain.on("authorize-folder", onAuthorizeFolder);
electron.ipcMain.on("check-path-authorization", onCheckPathAuthorization);
electron.ipcMain.on("send-message", onSendMessage);

const secretKeys = new Map<Electron.WebContents, string[]>();

function onSetupKey(event: Electron.IpcMainEvent, secretKey: string) {
  let keys = secretKeys.get(event.sender);

  if (keys == null) {
    keys = [];
    secretKeys.set(event.sender, keys);
  }

  keys.push(secretKey);
}

function onChooseFolder(event: Electron.IpcMainEvent, secretKey: string, ipcId: string, origin: string) {
  if (!secretKeys.get(event.sender).includes(secretKey)) return;

  const promise = electron.dialog.showOpenDialog({ properties: [ "openDirectory" ] });
  promise.then((result) => {
    if (result.canceled) { event.sender.send("choose-folder-callback", ipcId, null); return; }

    const normalizedPath = path.normalize(result.filePaths[0]);
    getAuthorizationsForOrigin(origin).folders.push(normalizedPath);

    event.sender.send("choose-folder-callback", ipcId, normalizedPath);
  });
}

function onChooseFile(event: Electron.IpcMainEvent, secretKey: string, ipcId: string, origin: string, access: "readWrite"|"execute") {
  if (!secretKeys.get(event.sender).includes(secretKey)) return;

  const promise = electron.dialog.showOpenDialog({ properties: [ "openFile" ] });
  promise.then((result) => {
    if (result.canceled) { event.sender.send("choose-file-callback", ipcId, null); return; }

    const normalizedPath = path.normalize(result.filePaths[0]);
    const auths = getAuthorizationsForOrigin(origin);

    if (access === "execute") auths.exeFiles.push(normalizedPath);
    else auths.rwFiles.push(normalizedPath);

    event.sender.send("choose-file-callback", ipcId, normalizedPath);
  });
}

function onAuthorizeFolder(event: Electron.IpcMainEvent, secretKey: string, ipcId: string, origin: string, folderPath: string) {
  const normalizedPath = path.normalize(folderPath);
  getAuthorizationsForOrigin(origin).folders.push(normalizedPath);

  event.sender.send("authorize-folder-callback", ipcId);
}

function onCheckPathAuthorization(event: Electron.IpcMainEvent, secretKey: string, ipcId: string, origin: string, pathToCheck: string) {
  if (!secretKeys.get(event.sender).includes(secretKey)) return;

  const normalizedPath = path.normalize(pathToCheck);

  const authorizations = getAuthorizationsForOrigin(origin);

  let canReadWrite = authorizations.rwFiles.indexOf(normalizedPath) !== -1;
  let canExecute = authorizations.exeFiles.indexOf(normalizedPath) !== -1;

  if (!canReadWrite) {
    for (const authorizedFolderPath of authorizations.folders) {
      if (normalizedPath.indexOf(authorizedFolderPath + path.sep) === 0) {
        canReadWrite = true;
        break;
      }
    }
  }

  const authorization = canReadWrite ? "readWrite" : (canExecute ? "execute" : null);
  event.sender.send("check-path-authorization-callback", ipcId, normalizedPath, authorization);
}

function onSendMessage(event: Electron.Event, windowId: number, message: string, args: any[] = []) {
  const window = electron.BrowserWindow.fromId(windowId);
  if (window == null) return;

  window.webContents.send(`sup-app-message-${message}`, ...args);
}
