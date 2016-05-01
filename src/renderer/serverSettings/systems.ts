import { ChildProcess } from "child_process";
import forkServerProcess from "../forkServerProcess";
import * as TreeView from "dnd-tree-view";
import * as dialogs from "simple-dialogs";
import html from "../html";
import * as i18n from "../../shared/i18n";

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const systemsPaneElt = settingsElt.querySelector(".systems") as HTMLDivElement;

const treeView = new TreeView(systemsPaneElt.querySelector(".tree-view-container") as HTMLDivElement);
treeView.addListener("selectionChange", onSelectionChange);

const refreshButton = systemsPaneElt.querySelector(".registry .actions .refresh") as HTMLButtonElement;
refreshButton.addEventListener("click", refreshRegistry);

const installOrUninstallButton = systemsPaneElt.querySelector(".details .actions .install-uninstall") as HTMLButtonElement;
installOrUninstallButton.addEventListener("click", onInstallOrUninstallClick);
const updateButton = systemsPaneElt.querySelector(".details .actions .update") as HTMLButtonElement;
updateButton.addEventListener("click", onUpdateClick);

const progressLabel = systemsPaneElt.querySelector(".details .actions .progress") as HTMLLabelElement;

let serverProcess: ChildProcess;
let registry: {
  version: number;
  core: {
    version: string;
    downloadURL: string;
    localVersion: string;
    isLocalDev: boolean;
  }
  systems: { [sytemId: string]: {
    repository: string;
    version: string;
    downloadURL: string;
    localVersion: string;
    isLocalDev: boolean;
    plugins: { [author: string]: { [name: string]: string } }
} } };

function refreshRegistry() {
  if (serverProcess != null) return;

  registry = null;
  treeView.clear();

  refreshButton.disabled = true;
  installOrUninstallButton.disabled = true;
  updateButton.disabled = true;

  serverProcess = forkServerProcess([ "registry" ]);
  serverProcess.on("message", onRegistryReceived);
  serverProcess.on("exit", () => {
    serverProcess = null;

    refreshButton.disabled = false;
  });
}

function onRegistryReceived(event: any) {
  if (event.type !== "registry") {
    // TODO: Whoops?! Handle error?
    console.log(event);
    return;
  }

  registry = event.registry;
  const systemsById = registry.systems;

  for (const systemId in systemsById) {
    const system = systemsById[systemId];

    const systemElt = html("li", { dataset: { systemId }});
    html("div", "label", { parent: systemElt });
    treeView.append(systemElt, "group");

    updateSystemLabel(systemId);

    for (const authorName in system.plugins) {
      const plugins = system.plugins[authorName];

      const authorElt = html("li");
      html("div", "label", { parent: authorElt, textContent: `${authorName} (${Object.keys(plugins).length} plugins)` });
      treeView.append(authorElt, "group", systemElt);

      for (const pluginName in plugins) {
        // const plugin = plugins[pluginName];

        const pluginElt = html("li");
        html("div", "label", { parent: pluginElt, textContent: `${pluginName}` });
        treeView.append(pluginElt, "item", authorElt);
      }
    }
  }
}

function updateSystemLabel(systemId: string) {
  const systemLabeElt = treeView.treeRoot.querySelector(`li[data-system-id=${systemId}] .label`) as HTMLLabelElement;
  const system = registry.systems[systemId];
  const local = system.isLocalDev ? "Installed: DEV" : (system.localVersion != null ? `Installed: v${system.localVersion}` : "Not Installed");
  systemLabeElt.textContent = `${systemId} (Latest: v${system.version}, ${local})`;
}

function onSelectionChange() {
  if (serverProcess != null || treeView.selectedNodes.length !== 1) {
    installOrUninstallButton.disabled = true;
    updateButton.disabled = true;
    return;
  }

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const system = systemId != null ? registry.systems[systemId] : null;
  if (system == null || system.isLocalDev) {
    installOrUninstallButton.disabled = true;
    updateButton.disabled = true;
    installOrUninstallButton.textContent = i18n.t("common:actions.install");
    return;
  }

  installOrUninstallButton.disabled = false;
  if (system.localVersion == null) {
    installOrUninstallButton.textContent = i18n.t("common:actions.install");
    updateButton.disabled = true;
  } else {
    installOrUninstallButton.textContent = i18n.t("common:actions.uninstall");
    updateButton.disabled = system.version === system.localVersion;
  }
}

function onInstallOrUninstallClick() {
  if (serverProcess != null) return;

  refreshButton.disabled = true;
  installOrUninstallButton.disabled = true;
  updateButton.disabled = true;

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const system = registry.systems[systemId];
  const action = system.localVersion == null ? "install" : "uninstall";

  serverProcess = forkServerProcess([ action, systemId, "--force", `--download-url=${system.downloadURL}` ]);
  progressLabel.textContent = `Running...`;

  serverProcess.on("message", onOperationProgress);
  serverProcess.on("exit", (statusCode: number) => {
    console.log(statusCode);
    serverProcess = null;
    progressLabel.textContent = "";

    if (statusCode === 0) {
      system.localVersion = action === "install" ? system.version : null;
      updateSystemLabel(systemId);
    }

    refreshButton.disabled = false;
    onSelectionChange();
  });
}

function onUpdateClick() {
  if (serverProcess != null) return;

  refreshButton.disabled = true;
  installOrUninstallButton.disabled = true;
  updateButton.disabled = true;

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const system = registry.systems[systemId];

  serverProcess = forkServerProcess([ "update", systemId, "--force", `--download-url=${system.downloadURL}` ]);
  progressLabel.textContent = `Running...`;

  serverProcess.on("message", onOperationProgress);
  serverProcess.on("exit", (statusCode: number) => {
    serverProcess = null;
    progressLabel.textContent = "";

    if (statusCode === 0) {
      system.localVersion =  system.version;
      updateSystemLabel(systemId);
    }

    refreshButton.disabled = false;
    onSelectionChange();
  });
}

function onOperationProgress(event: any) {
  if (event.type === "error") {
    /* tslint:disable:no-unused-expression */
    new dialogs.InfoDialog(event.message);
    /* tslint:enable:no-unused-expression */
    return;
  }

  if (event.type !== "progress") {
    // TODO: Whoops?! Handle error?
    console.log(event);
    return;
  }

  progressLabel.textContent = `${event.value}%`;
}
