import { ChildProcess } from "child_process";
import forkServerProcess from "../forkServerProcess";
import * as TreeView from "dnd-tree-view";
import * as dialogs from "simple-dialogs";
import html from "../html";
import * as i18n from "../../shared/i18n";
import * as localServer from "../localServer";

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const systemsPaneElt = settingsElt.querySelector(".systems") as HTMLDivElement;

const treeView = new TreeView(systemsPaneElt.querySelector(".tree-view-container") as HTMLDivElement, { multipleSelection: false });
treeView.addListener("selectionChange", updateUI);

const refreshButton = systemsPaneElt.querySelector(".registry .actions .refresh") as HTMLButtonElement;
refreshButton.addEventListener("click", refreshRegistry);
const updateAllButton = systemsPaneElt.querySelector(".registry .actions .update-all") as HTMLButtonElement;
updateAllButton.addEventListener("click", () => { updateAll(); });

const detailsElt = systemsPaneElt.querySelector(".details .content") as HTMLDivElement;

const installOrUninstallButton = detailsElt.querySelector(".header .install-uninstall") as HTMLButtonElement;
installOrUninstallButton.addEventListener("click", installOrUninstallClick);
const updateButton = detailsElt.querySelector(".header .update") as HTMLButtonElement;
updateButton.addEventListener("click", onUpdateClick);

const installedLabel = detailsElt.querySelector(".header .installed") as HTMLLabelElement;
const latestLabel = detailsElt.querySelector(".header .latest") as HTMLLabelElement;

let registry: Registry;
let registryServerProcess: ChildProcess;
const serverProcessById: { [id: string]: ChildProcess } = {};

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
  if (registryServerProcess != null) return;

  registry = null;
  treeView.clear();

  registryServerProcess = forkServerProcess([ "registry" ]);
  updateUI();

  registryServerProcess.on("message", onRegistryReceived);
  registryServerProcess.on("exit", () => {
    registryServerProcess = null;
    updateUI();
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

    const systemElt = html("li", { dataset: { id: systemId } });
    html("div", "label", { parent: systemElt, textContent: systemId });
    html("div", "progress", { parent: systemElt });
    treeView.append(systemElt, "group");

    for (const authorName in system.plugins) {
      const plugins = system.plugins[authorName];

      const authorElt = html("li");
      html("div", "label", { parent: authorElt, textContent: `${authorName} (${Object.keys(plugins).length} plugins)` });
      treeView.append(authorElt, "group", systemElt);

      for (const pluginName in plugins) {
        const pluginElt = html("li", { dataset: { id: `${systemId}:${authorName}/${pluginName}` } });
        html("div", "label", { parent: pluginElt, textContent: pluginName });
        html("div", "progress", { parent: pluginElt });
        treeView.append(pluginElt, "item", authorElt);
      }
    }
  }

  for (const getRegistryCallback of getRegistryCallbacks) getRegistryCallback(registry);
  getRegistryCallbacks.length = 0;
}

type ActionItem = { systemId: string; authorName?: string; pluginName?: string };
export function action(command: string, item: ActionItem, callback?: (succeed: boolean) => void) {
  getRegistry((registry) => {
    const id = item.pluginName != null ? `${item.systemId}:${item.authorName}/${item.pluginName}` : item.systemId;

    const progressElt = treeView.treeRoot.querySelector(`li[data-id="${id}"] .progress`) as HTMLDivElement;
    const registryItem = item.pluginName != null ? registry.systems[item.systemId].plugins[item.authorName][item.pluginName] : registry.systems[item.systemId];

    progressElt.textContent = "...";
    const process = serverProcessById[id] = forkServerProcess([ command, id, "--force", `--download-url=${registryItem.downloadURL}` ]);
    updateUI();

    process.on("message", (event: any) => {
      if (event.type === "error") {
        new dialogs.InfoDialog(event.message);
        return;
      }

      if (event.type !== "progress") {
        // TODO: Whoops?! Handle error?
        console.log(event);
        return;
      }

      progressElt.textContent = `${event.value}%`;
    });
    process.on("exit", (statusCode: number) => {
      progressElt.textContent = "";
      delete serverProcessById[id];
      if (statusCode === 0) registryItem.localVersion = command === "uninstall" ? null : registryItem.version;
      updateUI();

      if (callback != null) callback(statusCode === 0);
    });
  });
}

export function updateAll(callback?: Function) {
  getRegistry((registry) => {
    async.each(Object.keys(registry.systems), (systemId, cb) => {
      console.log("system", systemId);
      const system = registry.systems[systemId];
      async.parallel([
        (systemCb) => {
          if (!system.isLocalDev && system.localVersion != null && system.version !== system.localVersion)
            action("update", { systemId }, () => { systemCb(); });
          else
            systemCb();
        }, (pluginsCb) => {
          async.each(Object.keys(system.plugins), (authorName, authorCb) => {
            const pluginsByName = system.plugins[authorName];
            async.each(Object.keys(pluginsByName), (pluginName, pluginCb) => {
              const plugin = system.plugins[authorName][pluginName];
              if (!plugin.isLocalDev && plugin.localVersion != null && plugin.version !== plugin.localVersion)
                action("update", { systemId, authorName, pluginName }, () => { pluginCb(); });
              else
                pluginCb();
            }, authorCb);
          }, pluginsCb);
        }
      ], cb);
    }, () => { if (callback != null) callback(); });
  });
}

function updateUI() {
  if (registryServerProcess != null) {
    refreshButton.disabled = true;
    detailsElt.hidden = true;
    localServer.setServerUpdating(false);
    return;
  }

  const updating = Object.keys(serverProcessById).length > 0;
  refreshButton.disabled = updating;
  localServer.setServerUpdating(updating);

  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id != null) {
    detailsElt.hidden = false;

    const [ systemId, pluginPath ] = id.split(":");
    const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];
    const registryItem = pluginName != null ? registry.systems[systemId].plugins[authorName][pluginName] : registry.systems[systemId];

    installOrUninstallButton.disabled = serverProcessById[id] != null || registryItem.isLocalDev;
    updateButton.disabled = serverProcessById[id] != null || registryItem.isLocalDev || registryItem.localVersion == null || registryItem.version === registryItem.localVersion;

    const installOrUninstallAction = registryItem.isLocalDev || registryItem.localVersion == null ? "install" : "uninstall";
    installOrUninstallButton.textContent = i18n.t(`common:actions.${installOrUninstallAction}`);

    installedLabel.textContent = i18n.t("server:systems.installed", { installed: registryItem.isLocalDev ? "DEV" : (registryItem.localVersion != null ? registryItem.localVersion : "")});
    latestLabel.textContent = i18n.t("server:systems.latest", { latest: registryItem.version });

    // TODO: Update system details (version, description, ...)
  } else {
    detailsElt.hidden = true;
  }
}

function installOrUninstallClick() {
  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id == null || serverProcessById[id] != null) return;

  const [ systemId, pluginPath ] = id.split(":");
  const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];
  const registryItem = pluginName != null ? registry.systems[systemId].plugins[authorName][pluginName] : registry.systems[systemId];

  action(registryItem.localVersion == null ? "install" : "uninstall", { systemId, authorName, pluginName });
}

function onUpdateClick() {
  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id == null || serverProcessById[id] != null) return;

  const [ systemId, pluginPath ] = id.split(":");
  const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];

  action("update", { systemId, authorName, pluginName });
}
