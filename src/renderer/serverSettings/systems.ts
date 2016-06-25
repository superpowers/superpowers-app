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
installOrUninstallButton.addEventListener("click", installOrUninstallClick);
const updateButton = systemsPaneElt.querySelector(".details .actions .update") as HTMLButtonElement;
updateButton.addEventListener("click", onUpdateClick);

const progressLabel = systemsPaneElt.querySelector(".details .actions .progress") as HTMLLabelElement;

let serverProcess: ChildProcess;
let registry: Registry;

export type Registry = {
  version: number;
  core: ItemData;
  systems: { [sytemId: string]: SystemData }
}
interface ItemData {
  version: string;
  downloadURL: string;
  localVersion: string;
  isLocalDev: boolean; };
interface SystemData extends ItemData {
  repository: string;
  plugins: { [authorName: string]: { [pluginName: string]: ItemData; } };
}

type RegistryCallback = (registry: Registry) => void;

let getRegistryCallbacks: RegistryCallback[] = [];
export function getRegistry(callback: RegistryCallback) {
  if (registry != null) {
    callback(registry);
  } else {
    getRegistryCallbacks.push(callback);
    refreshRegistry();
  }
}

export function refreshRegistry() {
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

export function action(command: string, item: string, downloadURL: string, callback: (succeed: boolean) => void, progressCallback: (progress: number) => void) {
  serverProcess = forkServerProcess([ command, item, "--force", `--download-url=${downloadURL}` ]);

  // FIXME: The update on the core fails somehow if we remove this line
  serverProcess.stdout.on("data", (data: any) => { /* NOTHING */ });

  serverProcess.on("message", (event: any) => {
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

    progressCallback(event.value);
  });
  serverProcess.on("exit", (statusCode: number) => {
    serverProcess = null;
    callback(statusCode === 0);
  });
}

export function installGameSystem(callback: Function) {
  getRegistry((registry) => {
    treeView.clearSelection();
    const systemElt = treeView.treeRoot.querySelector(`li[data-system-id=game]`) as HTMLLIElement;
    treeView.addToSelection(systemElt);

    action("install", "game", registry.systems["game"].downloadURL, (succeed) => {
      progressLabel.textContent = "";
      callback();
    }, (progress) => { progressLabel.textContent = `${progress}%`; });
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

    const systemElt = html("li", { dataset: { systemId } });
    html("div", "label", { parent: systemElt });
    treeView.append(systemElt, "group");

    updateSystemLabel(systemId);

    for (const authorName in system.plugins) {
      const plugins = system.plugins[authorName];

      const authorElt = html("li");
      html("div", "label", { parent: authorElt, textContent: `${authorName} (${Object.keys(plugins).length} plugins)` });
      treeView.append(authorElt, "group", systemElt);

      for (const pluginName in plugins) {
        const pluginElt = html("li", { dataset: { systemId, authorName, pluginName } });
        html("div", "label", { parent: pluginElt });
        treeView.append(pluginElt, "item", authorElt);

        updatePluginLabel(systemId, authorName, pluginName);
      }
    }
  }

  for (const getRegistryCallback of getRegistryCallbacks) getRegistryCallback(registry);
  getRegistryCallbacks.length = 0;
}

function updateSystemLabel(systemId: string) {
  const systemLabeElt = treeView.treeRoot.querySelector(`li[data-system-id=${systemId}] .label`) as HTMLLabelElement;
  const system = registry.systems[systemId];
  const local = system.isLocalDev ? "Installed: DEV" : (system.localVersion != null ? `Installed: v${system.localVersion}` : "Not Installed");
  systemLabeElt.textContent = `${systemId} (Latest: v${system.version}, ${local})`;
}

function updatePluginLabel(systemId: string, authorName: string, pluginName: string) {
  const pluginLabeElt = treeView.treeRoot.querySelector(`li[data-system-id=${systemId}][data-author-name=${authorName}][data-plugin-name=${pluginName}] .label`) as HTMLLabelElement;
  const plugin = registry.systems[systemId].plugins[authorName][pluginName];
  const local = plugin.isLocalDev ? "Installed: DEV" : (plugin.localVersion != null ? `Installed: v${plugin.localVersion}` : "Not Installed");
  pluginLabeElt.textContent = `${pluginName} (Latest: v${plugin.version}, ${local})`;
}

function onSelectionChange() {
  if (serverProcess != null || treeView.selectedNodes.length !== 1) {
    installOrUninstallButton.disabled = true;
    updateButton.disabled = true;
    return;
  }

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const authorName = treeView.selectedNodes[0].dataset["authorName"];
  const pluginName = treeView.selectedNodes[0].dataset["pluginName"];

  const system = systemId != null ? registry.systems[systemId] : null;
  const plugin = system != null && authorName != null ? system.plugins[authorName][pluginName] : null;

  if (system == null || (plugin == null && system.isLocalDev) || (plugin != null && plugin.isLocalDev)) {
    installOrUninstallButton.disabled = true;
    updateButton.disabled = true;
    installOrUninstallButton.textContent = i18n.t("common:actions.install");
    return;
  }

  installOrUninstallButton.disabled = false;
  if ((plugin == null && system.localVersion == null) || (plugin != null && plugin.localVersion == null)) {
    installOrUninstallButton.textContent = i18n.t("common:actions.install");
    updateButton.disabled = true;
  } else {
    installOrUninstallButton.textContent = i18n.t("common:actions.uninstall");
    updateButton.disabled = (plugin == null && system.version === system.localVersion) || (plugin != null && plugin.version === plugin.localVersion);
  }
}

function installOrUninstallClick() {
  if (serverProcess != null) return;

  refreshButton.disabled = true;
  installOrUninstallButton.disabled = true;
  updateButton.disabled = true;

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const authorName = treeView.selectedNodes[0].dataset["authorName"];
  const pluginName = treeView.selectedNodes[0].dataset["pluginName"];

  const system = registry.systems[systemId];
  const plugin = authorName != null ? system.plugins[authorName][pluginName] : null;

  const item = (plugin == null ? systemId : `${systemId}:${authorName}/${pluginName}`);
  const downloadURL = plugin != null ? plugin.downloadURL : system.downloadURL;

  progressLabel.textContent = `Running...`;

  if ((plugin == null && system.localVersion == null) || (plugin != null && plugin.localVersion == null)) {
    action("install", item, downloadURL, (succeed) => {
      progressLabel.textContent = "";

      if (succeed) {
        if (plugin == null) {
          system.localVersion = system.version;
          updateSystemLabel(systemId);
        } else {
          plugin.localVersion = plugin.version;
          updatePluginLabel(systemId, authorName, pluginName);
        }
      }

      refreshButton.disabled = false;
      onSelectionChange();

    }, (progress) => { progressLabel.textContent = `${progress}%`; });
  } else {
    action("uninstall", item, downloadURL, (succeed) => {
      progressLabel.textContent = "";

      if (succeed) {
        if (plugin == null) {
          system.localVersion = null;
          updateSystemLabel(systemId);
        } else {
          plugin.localVersion = null;
          updatePluginLabel(systemId, authorName, pluginName);
        }
      }

      refreshButton.disabled = false;
      onSelectionChange();

    }, (progress) => { progressLabel.textContent = `${progress}%`; });
  }
}

function onUpdateClick() {
  if (serverProcess != null) return;

  refreshButton.disabled = true;
  installOrUninstallButton.disabled = true;
  updateButton.disabled = true;

  const systemId = treeView.selectedNodes[0].dataset["systemId"];
  const authorName = treeView.selectedNodes[0].dataset["authorName"];
  const pluginName = treeView.selectedNodes[0].dataset["pluginName"];

  const system = registry.systems[systemId];
  const plugin = authorName != null ? system.plugins[authorName][pluginName] : null;
  const item = (plugin == null ? systemId : `${systemId}:${authorName}/${pluginName}`);
  const downloadURL = plugin != null ? plugin.downloadURL : system.downloadURL;

  progressLabel.textContent = `Running...`;

  action("update", item, downloadURL, (succeed) => {
    progressLabel.textContent = "";

    if (succeed) {
      if (plugin == null) {
        system.localVersion = system.version;
        updateSystemLabel(systemId);
      } else {
        plugin.localVersion = plugin.version;
        updatePluginLabel(systemId, authorName, pluginName);
      }
    }

    refreshButton.disabled = false;
    onSelectionChange();

  }, (progress) => { progressLabel.textContent = `${progress}%`; });
}
