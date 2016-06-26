import { ChildProcess } from "child_process";
import forkServerProcess from "./forkServerProcess";
import * as settings from "./settings";
import * as i18n from "../shared/i18n";
import openServerSettings from "./tabs/openServerSettings";
import * as serverSettings from "./serverSettings";
import { append as appendToLog } from "./serverSettings/log";

let serverProcess: ChildProcess;

const localServerElt = document.querySelector(".local-server") as HTMLDivElement;
const statusElt = localServerElt.querySelector(".status") as HTMLDivElement;
export const startStopServerButton = localServerElt.querySelector(".start-stop") as HTMLButtonElement;
const settingsButton = localServerElt.querySelector(".settings") as HTMLButtonElement;

export function start() {
  startStopServerButton.addEventListener("click", startStopServer);
  settingsButton.addEventListener("click", openServerSettings);

  if (settings.autoStartServer) startServer();
}

function startStopServer() {
  if (serverProcess == null) startServer();
  else stopServer();
}

function startServer() {
  if (serverProcess != null) return;

  statusElt.textContent = i18n.t("server:status.starting");
  startStopServerButton.textContent = i18n.t("server:buttons.stop");

  serverSettings.enable(false);
  serverSettings.applyScheduledSave();

  serverProcess = forkServerProcess([ "start" ]);
  serverProcess.on("exit", onServerExit);
  serverProcess.on("message", onServerMessage);
  serverProcess.stdout.on("data", (data: any) => { appendToLog(String(data)); });
  serverProcess.stderr.on("data", (data: any) => { appendToLog(String(data)); });
}

let shutdownCallback: Function;
export function shutdown(callback: Function) {
  if (serverProcess == null) { callback(); return; }
  shutdownCallback = callback;
  stopServer();
}

export function stopServer() {
  if (serverProcess == null) return;

  statusElt.textContent = i18n.t("server:status.stopping");
  startStopServerButton.textContent = i18n.t("server:buttons.start");
  startStopServerButton.disabled = true;
  serverProcess.send("stop");
}

function onServerExit() {
  serverProcess = null;

  statusElt.textContent = i18n.t("server:status.stopped");
  startStopServerButton.textContent = i18n.t("server:buttons.start");
  startStopServerButton.disabled = false;
  serverSettings.enable(true);

  appendToLog("\n");

  if (shutdownCallback != null) {
    shutdownCallback();
    shutdownCallback = null;
  }
}

function onServerMessage(msg: any) {
  if (typeof msg !== "object") return;

  switch (msg.type) {
    case "started":
      statusElt.textContent = i18n.t("server:status.started");
      break;
  }
}
