import * as electron from "electron";
import * as i18n from "../shared/i18n";
import * as settings from "./settings";
import * as sidebar from "./sidebar";
import * as chat from "./chat";

electron.ipcRenderer.on("init", onInitialize);
window.addEventListener("message", onMessageReceived);

const loadingElt = document.querySelector(".loading") as HTMLDivElement;

function onInitialize(sender: any, userDataPath: string, languageCode: string) {
  i18n.languageCode = languageCode;
  i18n.load([ "common", "sidebar" ], () => {
    settings.load(`${userDataPath}/settings.json`, onSettingsLoaded);
  });
}

function onSettingsLoaded(err: i18n.LocalizedError) {
  if (err != null) {
    loadingElt.querySelector("div").textContent = i18n.t(err.key, err.variables);
    // TODO: Provide the option to start with empty settings anyway
    return;
  }

  start();
}

function start() {
  // TODO: Animate!
  loadingElt.parentElement.removeChild(loadingElt);

  sidebar.start();
  chat.start();
}

function onMessageReceived(event: MessageEvent) {
  switch (event.data.type) {
    case "new-standalone-window": {
      electron.ipcRenderer.send("new-standalone-window", event.data.url, event.data.title);
      break;
    }
  }
}
