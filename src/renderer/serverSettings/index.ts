import * as fs from "fs";
import * as electron from "electron";
import * as ResizeHandle from "resize-handle";
import * as settings from "../settings";

new ResizeHandle(document.querySelector(".server-log") as HTMLDivElement, "bottom");

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;

const mainPortElt = settingsElt.querySelector(".main-port input") as HTMLInputElement;
const buildPortElt = settingsElt.querySelector(".build-port input") as HTMLInputElement;
const autoStartServerElt = settingsElt.querySelector("#auto-start-server-checkbox") as HTMLInputElement;

const openProjectsFolderElt = settingsElt.querySelector(".projects-folder button") as HTMLButtonElement;
const maxRecentBuildsElt = settingsElt.querySelector(".max-recent-builds input") as HTMLInputElement;


const logTextarea = settingsElt.querySelector(".server-log textarea") as HTMLTextAreaElement;
const clearServerLogButton = settingsElt.querySelector(".server-log button.clear") as HTMLButtonElement;
clearServerLogButton.addEventListener("click", onClearLogButtonClick);

export function start() {
  const serverConfig = getServerConfig();

  mainPortElt.value = serverConfig.mainPort.toString();
  buildPortElt.value = serverConfig.buildPort.toString();
  maxRecentBuildsElt.value = serverConfig.maxRecentBuilds.toString();

  autoStartServerElt.checked = settings.autoStartServer;
  autoStartServerElt.addEventListener("change", onChangeAutoStartServer);

  openProjectsFolderElt.addEventListener("click", onOpenProjectsFolderClick);
}

interface ServerConfig {
  mainPort: number;
  buildPort: number;
  maxRecentBuilds: number;
  [key: string]: any;
}
function getServerConfig() {
  /* tslint:disable */
  const defaultConfig: ServerConfig = require(`${settings.userDataPath}/core/server/config.js`).defaults;
  /* tslint:enable */
  console.log(defaultConfig);

  let localConfig: ServerConfig;
  try {
    localConfig = JSON.parse(fs.readFileSync(`${settings.userDataPath}/config.json`, { encoding: "utf8" }));
  } catch (err) { /* Ignore */ }
  if (localConfig == null) localConfig = {} as any;

  const config: ServerConfig = {} as any;
  for (const key in defaultConfig) {
    if (localConfig[key] != null) config[key] = localConfig[key];
    else config[key] = defaultConfig[key];
  }

  console.log(config);
  return config;
}

function onOpenProjectsFolderClick() {
  electron.shell.showItemInFolder(settings.userDataPath);
}

function onChangeAutoStartServer() {
  settings.autoStartServer = autoStartServerElt.checked;
  settings.scheduleSave();
}

export function appendToLog(text: string) {
  logTextarea.value += `${text}\n`;
  setTimeout(() => { logTextarea.scrollTop = logTextarea.scrollHeight; }, 0);
}

function onClearLogButtonClick(event: MouseEvent) {
  event.preventDefault();

  logTextarea.value = "";
}
