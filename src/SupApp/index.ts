import * as electron from "electron";

import * as  fs from "fs";
import * as fsMkdirp from "mkdirp";
import * as childProcess from "child_process";

const currentWindow = electron.remote.getCurrentWindow();

let nextIpcId = 0;
function getNextIpcId(): string {
  const ipcId = nextIpcId.toString();
  nextIpcId++;
  return ipcId;
}
const ipcCallbacks: { [id: string]: Function } = {};

electron.ipcRenderer.on("choose-folder-callback", onFolderChosen);
electron.ipcRenderer.on("choose-file-callback", onFileChosen);
electron.ipcRenderer.on("check-path-authorization-callback", onPathAuthorizationChecked);

type ChooseFolderCallback = (err: string, folder: string) => void;
type ChooseFileCallback = (err: string, filename: string) => void;
type CheckPathAuthorizationCallback = (normalizedPath: string, authorized: boolean) => void;

interface OpenWindowOptions {
  size?: { width: number; height: number; };
  minSize?: { width: number; height: number; };
  resizable?: boolean;
}

function onFolderChosen(event: Electron.IpcRendererEvent, ipcId: string, err: string, folderPath: string) {
  const callback = ipcCallbacks[ipcId] as ChooseFolderCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(err, folderPath);
}

function onFileChosen(event: Electron.IpcRendererEvent, ipcId: string, err: string, filename: string) {
  const callback = ipcCallbacks[ipcId] as ChooseFileCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(err, filename);
}

function checkPathAuthorization(pathToCheck: string, callback: CheckPathAuthorizationCallback) {
  const ipcId = getNextIpcId();
  ipcCallbacks[ipcId] = callback;
  electron.ipcRenderer.send("check-path-authorization", ipcId, window.location.origin, pathToCheck);
}

function onPathAuthorizationChecked(event: Electron.IpcRendererEvent, ipcId: string, checkedPath: string, authorized: boolean) {
  const callback = ipcCallbacks[ipcId] as CheckPathAuthorizationCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(checkedPath, authorized);
}

namespace SupApp {
  export function getCurrentWindow() { return currentWindow; }
  export function getIpc() { return electron.ipcRenderer; }

  export function showMainWindow() { electron.ipcRenderer.send("show-main-window"); }

  export function openWindow(url: string, options?: OpenWindowOptions) {
    if (options == null) options = {};

    if (options.size == null && options.minSize == null) {
      options.size = { width: 1280, height: 800 };
      options.minSize = { width: 800, height: 480 };
    }

    if (options.resizable == null) options.resizable = true;

    const electronWindowOptions: Electron.BrowserWindowOptions = {
      icon: `${__dirname}/../superpowers.ico`,
      useContentSize: true, autoHideMenuBar: true,
      resizable: options.resizable,
      webPreferences: { nodeIntegration: false, preload: `${__dirname}/index.js` }
    };

    if (options.size != null) {
      electronWindowOptions.width = options.size.width;
      electronWindowOptions.height = options.size.height;
    }

    if (options.minSize != null) {
      electronWindowOptions.minWidth = options.minSize.width;
      electronWindowOptions.minHeight = options.minSize.height;
    }

    const window = new electron.remote.BrowserWindow(electronWindowOptions);

    window.webContents.on("will-navigate", (event: Event) => { event.preventDefault(); });
    window.loadURL(url);
    return window;
  }

  export function openLink(url: string) { electron.shell.openExternal(url); }
  export function showItemInFolder(path: string) { electron.shell.showItemInFolder(path); }

  export function createMenu() { return new electron.remote.Menu(); }
  export function createMenuItem(options: Electron.MenuItemOptions) {
    return new electron.remote.MenuItem(options);
  }

  export namespace clipboard {
    export function copyFromDataURL(dataURL: string) {
      const image = electron.nativeImage.createFromDataURL(dataURL);
      electron.clipboard.writeImage(image);
    }
  }

  export function chooseFolder(callback: ChooseFolderCallback) {
    const ipcId = getNextIpcId();
    ipcCallbacks[ipcId] = callback;
    electron.ipcRenderer.send("choose-folder", ipcId, window.location.origin);
  }

  export function chooseFile(callback: ChooseFileCallback) {
    const ipcId = getNextIpcId();
    ipcCallbacks[ipcId] = callback;
    electron.ipcRenderer.send("choose-file", ipcId, window.location.origin);
  }

  export function mkdirp(folderPath: string, callback: (err: any) => void) {
    checkPathAuthorization(folderPath, (normalizedFolderPath, authorized) => {
      if (!authorized) {
        callback(new Error(`Access to "${normalizedFolderPath}" hasn't been authorized.`));
        return;
      }

      fsMkdirp(normalizedFolderPath, callback);
    });
  }

  export function writeFile(filename: string, data: any, options: any, callback: (err: NodeJS.ErrnoException) => void) {
    if (callback == null && typeof options === "function") {
      callback = options;
      options = null;
    }

    checkPathAuthorization(filename, (normalizedFilename, authorized) => {
      if (!authorized) {
        callback(new Error(`Access to "${normalizedFilename}" hasn't been authorized.`));
        return;
      }

      fs.writeFile(normalizedFilename, data, options, callback);
    });
  }

  export function spawnChildProcess(filename: string, callback: (err: Error, childProcess?: childProcess.ChildProcess) => void) {
    checkPathAuthorization(filename, (normalizedFilename, authorized) => {
      if (!authorized) {
        callback(new Error(`Access to "${normalizedFilename}" hasn't been authorized.`));
        return;
      }

      const spawnedProcess = childProcess.spawn(filename);
      callback(null, spawnedProcess);
    });
  }
}

(global as any).SupApp = SupApp;
