import * as electron from "electron";
import * as settings from "../settings";

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const openProjectsFolderElt = settingsElt.querySelector(".open-projects-folder") as HTMLButtonElement;
const autoStartServerElt = settingsElt.querySelector(".auto-start-server input") as HTMLInputElement;

export function start() {
  openProjectsFolderElt.addEventListener("click", onOpenProjectsFolderClick);

  autoStartServerElt.checked = settings.autoStartServer;
  autoStartServerElt.addEventListener("change", onChangeAutoStartServer);
}

function onOpenProjectsFolderClick() {
  electron.shell.showItemInFolder(`${settings.userDataPath}/projects`);
}

function onChangeAutoStartServer() {
  settings.autoStartServer = autoStartServerElt.checked;
  settings.scheduleSave();
}
