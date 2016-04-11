import * as electron from "electron";
import { PublishOptions } from "../ipc";

const currentWindow = electron.remote.getCurrentWindow();

type ChooseFolderCallback = (err: string, folder: string) => void;
let chooseFolderCallback: ChooseFolderCallback;
electron.ipcRenderer.on("choose-folder-callback", (event: Electron.IpcRendererEvent, err: string, folder: string) => {
  if (chooseFolderCallback == null) return;
  chooseFolderCallback(err, folder);
  chooseFolderCallback = null;
});

namespace SupApp {
  export function getCurrentWindow() { return currentWindow; }
  export function getIpc() { return electron.ipcRenderer; }

  export function showMainWindow() { electron.ipcRenderer.send("show-main-window"); }

  export function openWindow(url: string) {
    const window = new electron.remote.BrowserWindow({
      icon: `${__dirname}/../superpowers.ico`,
      width: 1000, height: 600, minWidth: 800, minHeight: 480,
      useContentSize: true, autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, preload: `${__dirname}/index.js` }
    });

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
    chooseFolderCallback = callback;
    electron.ipcRenderer.send("choose-folder");
  }

  export function publishProject(options: PublishOptions) {
    electron.ipcRenderer.send("publish-project", options);
  }
}

(global as any).SupApp = SupApp;
