import * as electron from "electron";
import * as dialogs from "simple-dialogs";
import * as i18n from "../shared/i18n";
import * as settings from "./settings";
import * as splashScreen from "./splashScreen";
import * as updateManager from "./updateManager";
import * as sidebar from "./sidebar";
import * as home from "./home";

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

function onInitialize(sender: any, userDataPath: string, languageCode: string) {
  i18n.languageCode = languageCode;
  i18n.load([ "common", "startup", "sidebar", "server" ], () => {
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
}
