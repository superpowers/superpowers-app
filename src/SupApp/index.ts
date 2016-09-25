import * as crypto from "crypto";
import * as electron from "electron";
import * as async from "async";
import * as fs from "fs";
import * as fsMkdirp from "mkdirp";
import * as childProcess from "child_process";
import * as os from "os";

const currentWindow = electron.remote.getCurrentWindow();

const tmpRoot = os.tmpdir();
const tmpCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const getRandomTmpCharacter = () => tmpCharacters[Math.floor(Math.random() * tmpCharacters.length)];

const secretKey = crypto.randomBytes(48).toString("hex");
electron.ipcRenderer.send("setup-key", secretKey);

let nextIpcId = 0;
function getNextIpcId(): string {
  const ipcId = nextIpcId.toString();
  nextIpcId++;
  return ipcId;
}
const ipcCallbacks: { [id: string]: Function } = {};

electron.ipcRenderer.on("choose-folder-callback", onFolderChosen);
electron.ipcRenderer.on("choose-file-callback", onFileChosen);
electron.ipcRenderer.on("authorize-folder-callback", onFolderAuthorized);
electron.ipcRenderer.on("check-path-authorization-callback", onPathAuthorizationChecked);

type ChooseFolderCallback = (folder: string) => void;
type ChooseFileCallback = (filename: string) => void;
type AuthorizeFolderCallback = () => void;
type CheckPathAuthorizationCallback = (normalizedPath: string, access: "readWrite"|"execute") => void;

interface OpenWindowOptions {
  size?: { width: number; height: number; };
  minSize?: { width: number; height: number; };
  resizable?: boolean;
}

function onFolderChosen(event: Electron.IpcRendererEvent, ipcId: string, folderPath: string) {
  const callback = ipcCallbacks[ipcId] as ChooseFolderCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(folderPath);
}

function onFileChosen(event: Electron.IpcRendererEvent, ipcId: string, filename: string) {
  const callback = ipcCallbacks[ipcId] as ChooseFileCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(filename);
}

function onFolderAuthorized(event: Electron.IpcRendererEvent, ipcId: string) {
  const callback = ipcCallbacks[ipcId] as AuthorizeFolderCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback();
}

function checkPathAuthorization(pathToCheck: string, callback: CheckPathAuthorizationCallback) {
  const ipcId = getNextIpcId();
  ipcCallbacks[ipcId] = callback;
  electron.ipcRenderer.send("check-path-authorization", secretKey, ipcId, window.location.origin, pathToCheck);
}

function onPathAuthorizationChecked(event: Electron.IpcRendererEvent, ipcId: string, checkedPath: string, authorization: "readWrite"|"execute") {
  const callback = ipcCallbacks[ipcId] as CheckPathAuthorizationCallback;
  if (callback == null) return;
  delete ipcCallbacks[ipcId];

  callback(checkedPath, authorization);
}

namespace SupApp {
  export function onMessage(messageType: string, callback: Function) {
    electron.ipcRenderer.addListener(`sup-app-message-${messageType}`, (event, ...args) => { callback(...args); });
  }

  export function getCurrentWindow() { return currentWindow; }
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
    electron.ipcRenderer.send("choose-folder", secretKey, ipcId, window.location.origin);
  }

  export function chooseFile(access: "readWrite"|"execute", callback: ChooseFileCallback) {
    const ipcId = getNextIpcId();
    ipcCallbacks[ipcId] = callback;
    electron.ipcRenderer.send("choose-file", secretKey, ipcId, window.location.origin, access);
  }

  export function tryFileAccess(filePath: string, access: "readWrite"|"execute", callback: (err: any) => void) {
    checkPathAuthorization(filePath, (err, authorization) => {
      if (authorization !== access) { callback(new Error("Unauthorized")); return; }

      fs.exists(filePath, (exists) => {
        callback(exists ? null : new Error("Not found"));
      });
    });
  }

  export function mkdirp(folderPath: string, callback: (err: any) => void) {
    checkPathAuthorization(folderPath, (normalizedFolderPath, authorization) => {
      if (authorization !== "readWrite") {
        callback(new Error(`Access to "${normalizedFolderPath}" hasn't been authorized for read/write.`));
        return;
      }

      fsMkdirp(normalizedFolderPath, callback);
    });
  }

  export function mktmpdir(callback: (err: any, path: string) => void) {
    let tempFolderPath: string;
    async.retry(10, (cb: ErrorCallback) => {
      let folderName = "superpowers-temp-";
      for (let i = 0; i < 16; i++) folderName += getRandomTmpCharacter();
      tempFolderPath = `${tmpRoot}/${folderName}`;
      fs.mkdir(tempFolderPath, cb);
    }, (err) => {
      if (err != null) { callback(err, null); return; }

      const ipcId = getNextIpcId();
      ipcCallbacks[ipcId] = () => { callback(null, tempFolderPath); };
      electron.ipcRenderer.send("authorize-folder", secretKey, ipcId, window.location.origin, tempFolderPath);
    });
  }

  export function writeFile(filename: string, data: any, options: any, callback: (err: NodeJS.ErrnoException) => void) {
    if (callback == null && typeof options === "function") {
      callback = options;
      options = null;
    }

    checkPathAuthorization(filename, (normalizedFilename, authorization) => {
      if (authorization !== "readWrite") {
        callback(new Error(`Access to "${normalizedFilename}" hasn't been authorized for read/write.`));
        return;
      }

      // This hack is required because buffers might be passed from another JS context
      // (for example, from the build dialog). The other JS context will have its own Buffer object
      // and fs.writeFile uses `instanceof` to check if the object is a buffer, so it would fail.
      let oldProto: any;
      if (data._isBuffer) {
        oldProto = data.__proto__;
        data.__proto__ = Buffer.prototype;
      }

      fs.writeFile(normalizedFilename, data, options, callback);

      if (data._isBuffer) data.__proto__ = oldProto;
    });
  }

  export function readDir(folderPath: string, callback: (err: NodeJS.ErrnoException, files: string[]) => void) {
    fs.readdir(folderPath, callback);
  }

  export function spawnChildProcess(filename: string, args: string[], callback: (err: Error, childProcess?: childProcess.ChildProcess) => void) {
    checkPathAuthorization(filename, (normalizedFilename, authorization) => {
      if (authorization !== "execute") {
        callback(new Error(`Access to "${normalizedFilename}" for execution hasn't been authorized.`));
        return;
      }

      const spawnedProcess = childProcess.spawn(filename, args);
      callback(null, spawnedProcess);
    });
  }
}

(global as any).SupApp = SupApp;
