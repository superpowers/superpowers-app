import * as electron from "electron";
import * as dialogs from "simple-dialogs";
import * as i18n from "../shared/i18n";
import * as settings from "./settings";
import * as splashScreen from "./splashScreen";
import * as updateManager from "./updateManager";
import * as sidebar from "./sidebar";
import * as home from "./home";
import * as childProcess from "child_process";

setupDevToolsShortcut();

window.addEventListener("message", onMessageReceived);
electron.ipcRenderer.on("init", onInitialize);

function setupDevToolsShortcut() {
  window.addEventListener("keyup", (event) => {
    if (event.keyCode === 123) electron.remote.getCurrentWindow().webContents.openDevTools();
  });
}

function onMessageReceived(event: MessageEvent) {
  switch (event.data.type) {
    case "new-standalone-window": {
      electron.ipcRenderer.send("new-standalone-window", event.data.url, event.data.title);
      break;
    }
  }
}

const namespaces = [ "common", "startup", "sidebar", "server", "dialogs", "home" ];

function onInitialize(sender: any, userDataPath: string, languageCode: string) {
  i18n.languageCode = languageCode;
  i18n.load(namespaces, () => {
    settings.load(userDataPath, onSettingsLoaded);
  });
}

function onSettingsLoaded(err: Error) {
  if (err != null) {
    const label = i18n.t("startup:errors.couldNotLoadSettings", { reason: err.message });
    const options = {
      validationLabel: i18n.t("startup:startAnyway"),
      cancelLabel: i18n.t("common:actions.close")
    };

    new dialogs.ConfirmDialog(label, options, (shouldProceed) => {
      if (!shouldProceed) {
        electron.remote.app.quit();
        return;
      }

      updateManager.checkForUpdates(start);
    });
    return;
  }

  updateManager.checkForUpdates(start);
}

function start() {
  sidebar.start();
  home.start();

  splashScreen.fadeOut();

  // TEMPORARY: automatically start the server
  const serverPath = `${settings.userDataPath}/core/server/index.js`;

  const serverEnv: { [key: string]: string; } = {};
  serverEnv["ELECTRON_RUN_AS_NODE"] = "1";
  serverEnv["ELECTRON_NO_ATTACH_CONSOLE"] = "1";

  // NOTE: It would be nice to simply copy all environment variables
  // but somehow, this prevents Electron 0.35.1 from starting the server
  // for (const key in nodeProcess.env) serverEnv[key] = nodeProcess.env[key];

  // So instead, we'll just copy the environment variables we definitely need
  if (process.env["NODE_ENV"] != null) serverEnv["NODE_ENV"] = process.env["NODE_ENV"];
  if (process.env["APPDATA"] != null) serverEnv["APPDATA"] = process.env["APPDATA"];
  if (process.env["HOME"] != null) serverEnv["HOME"] = process.env["HOME"];
  if (process.env["XDG_DATA_HOME"] != null) serverEnv["XDG_DATA_HOME"] = process.env["XDG_DATA_HOME"];

  const serverProcess = childProcess.fork(serverPath, ["start", `--data-path=${settings.userDataPath}`], { silent: true, env: serverEnv });
  serverProcess.on("message", (msg: string) => { console.log(msg); });
}
