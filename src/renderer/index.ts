import * as dialogs from "simple-dialogs";
import * as electron from "electron";
import * as i18n from "../shared/i18n";
import * as settings from "./settings";
import * as sidebar from "./sidebar";
import * as chat from "./chat";
import fetchVersions from "./fetchVersions";

setupDevToolsShortcut();

const appVersion = getLocalAppVersion();

const loadingElt = document.querySelector(".loading") as HTMLDivElement;
const appVersionElt = loadingElt.querySelector(".version") as HTMLDivElement;
appVersionElt.textContent = appVersion;

window.addEventListener("message", onMessageReceived);
electron.ipcRenderer.on("init", onInitialize);

function setupDevToolsShortcut() {
  window.addEventListener("keyup", (event) => {
    if (event.keyCode === 123) electron.remote.getCurrentWindow().webContents.openDevTools();
  });
}

function getLocalAppVersion() {
  let appVersion = electron.remote.app.getVersion();
  if (appVersion === "dev") {
    const { version } = require(`${__dirname}/../../package.json`);
    appVersion = `v${version}-dev`;
  } else {
    appVersion = `v${appVersion}`;
  }
  return appVersion;
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
  i18n.load([ "common", "updates", "sidebar" ], () => {
    settings.load(`${userDataPath}/settings.json`, onSettingsLoaded);
  });
}

function onSettingsLoaded(err: i18n.LocalizedError) {
  if (err != null) {
    loadingElt.querySelector("div").textContent = i18n.t(err.key, err.variables);
    // TODO: Provide the option to start with empty settings anyway
    return;
  }

  checkForUpdates();
}

function checkForUpdates() {
  // TODO: install server and offer installing a system on first run!

  fetchVersions((err, components) => {
    if (components != null && components["app"].version !== appVersion && electron.remote.app.getVersion() !== "dev") {
      const label = i18n.t("updates:app", { latest: components["app"].version, current: appVersion });
      const options = {
        validationLabel: i18n.t("common:actions.download"),
        cancelLabel: i18n.t("common:actions.skip")
      };

      new dialogs.ConfirmDialog(label, options, (shouldDownload) => {
        if (shouldDownload) {
          electron.shell.openExternal("http://superpowers-html5.com/");
          electron.remote.app.quit();
          return;
        }

        start();
      });

      return;
    }

    start();
  });
}

let onAppReady: Function;

const splashElt = loadingElt.querySelector(".splash") as HTMLImageElement;
const statusElt = loadingElt.querySelector(".status") as HTMLDivElement;
splashElt.hidden = false;

let splashInAnim = (splashElt as any).animate([
  { opacity: "0", transform: "translateY(-50vh)" },
  { opacity: "1", transform: "translateY(0)" }
], { duration: 500, easing: "ease-out" });

splashInAnim.addEventListener("finish", () => {
  splashInAnim = null;
  if (onAppReady != null) onAppReady();
});

function start() {
  sidebar.start();
  chat.start();

  if (splashInAnim != null) onAppReady = playOutAnimation;
  else playOutAnimation();
}

function playOutAnimation() {
  const statusOutAnim = (statusElt as any).animate([ { opacity: "1" }, { opacity: "0" } ], { duration: 300, easing: "ease-in" });
  statusOutAnim.addEventListener("finish", () => {
    statusElt.style.opacity = "0";

    const loadingOutAnim = (loadingElt as any).animate([
      { opacity: "1" },
      { opacity: "0" }
    ], { duration: 300, easing: "ease-in" });

    const splashOutAnim = (splashElt as any).animate([
      { transform: "scale(1, 1)" },
      { transform: "scale(5, 5)" }
    ], { duration: 300, easing: "ease-in" });

    loadingOutAnim.addEventListener("finish", () => {
      loadingElt.parentElement.removeChild(loadingElt);
    });
  });
}
