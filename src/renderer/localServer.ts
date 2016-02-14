import * as childProcess from "child_process";
import * as settings from "./settings";
import * as i18n from "../shared/i18n";

let serverProcess: childProcess.ChildProcess;

const localServerElt = document.querySelector(".local-server") as HTMLDivElement;
const statusElt = localServerElt.querySelector(".status") as HTMLDivElement;
const startStopServerButton = localServerElt.querySelector(".start-stop") as HTMLButtonElement;
const settingsButton = localServerElt.querySelector(".settings") as HTMLButtonElement;

export function start() {
	startStopServerButton.addEventListener("click", startStopServer);
	settingsButton.addEventListener("click", openSettings);

	// if (settings.autoStartServer) startServer();
}

function startStopServer() {
	if (serverProcess == null) startServer();
	else stopServer();
}

function openSettings() {
	// TODO
}

function startServer() {
  if (serverProcess != null) return;

  statusElt.textContent = i18n.t("server:status.started"); // .starting
  startStopServerButton.textContent = i18n.t("server:buttons.stop");
  // startStopServerButton.disabled = true;

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

  serverProcess = childProcess.fork(serverPath, ["start", `--data-path=${settings.userDataPath}`], { silent: true, env: serverEnv });
  serverProcess.on("exit", onServerExit);
  serverProcess.on("message", onServerMessage);
}

function stopServer() {
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

  // myServerTextarea.value += "\n";
}

function onServerMessage(msg: string) {
	console.log(msg);

  // myServerTextarea.value += `${msg}\n`;
  // setTimeout(() => { myServerTextarea.scrollTop = myServerTextarea.scrollHeight; }, 0);
}
