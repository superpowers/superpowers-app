import * as electron from "electron";
import * as dialogs from "simple-dialogs";
import * as i18n from "../shared/i18n";
import * as settings from "./settings";
import * as splashScreen from "./splashScreen";
import * as updateManager from "./updateManager";
import * as sidebar from "./sidebar";
import * as me from "./sidebar/me";
import * as home from "./home";
import * as serverSettings from "./serverSettings";
import * as localServer from "./localServer";
import * as chat from "./chat";
import WelcomeDialog from "./WelcomeDialog";

electron.ipcRenderer.on("init", onInitialize);
electron.ipcRenderer.on("quit", onQuit);

const namespaces = [
  "common", "startup",
  "sidebar", "server",
  "welcome", "home"
];

function onInitialize(sender: any, corePath: string, userDataPath: string, languageCode: string) {
  settings.corePath = corePath;
  settings.userDataPath = userDataPath;

  i18n.languageCode = languageCode;
  i18n.load(namespaces, () => { settings.load(onSettingsLoaded); });
}

function onQuit() {
  localServer.shutdown(() => { electron.ipcRenderer.send("ready-to-quit"); });
}

function onSettingsLoaded(err: Error) {
  if (err != null) {
    const label = i18n.t("startup:errors.couldNotLoadSettings", { reason: err.message });
    const options = {
      validationLabel: i18n.t("startup:startAnyway"),
      cancelLabel: i18n.t("common:actions.close")
    };

    /* tslint:disable:no-unused-expression */
    new dialogs.ConfirmDialog(label, options, (shouldProceed) => {
      /* tslint:enable:no-unused-expression */
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
  serverSettings.start();
  localServer.start();

  if (settings.nickname == null) {
    showWelcomeDialog();
  } else {
    me.start();
    chat.start();
  }

  splashScreen.fadeOut();
}

function showWelcomeDialog() {
  /* tslint:disable:no-unused-expression */
  new WelcomeDialog((result) => {
    /* tslint:enable:no-unused-expression */
    settings.nickname = result.nickname;
    settings.presence = result.connectToChat ? "online" : "offline";

    settings.savedChatrooms = [ "#superpowers-html5" ];
    if (i18n.languageCode !== "en" && chat.languageChatRooms.indexOf(i18n.languageCode) !== -1) {
      settings.savedChatrooms.push(`#superpowers-html5-${i18n.languageCode}`);
    }

    settings.scheduleSave();

    me.start();
    chat.start();
  });
}
