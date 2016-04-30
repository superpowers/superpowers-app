import { ChildProcess } from "child_process";
import forkServerProcess from "../forkServerProcess";
import * as TreeView from "dnd-tree-view";
import html from "../html";

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const systemsPaneElt = settingsElt.querySelector(".systems") as HTMLDivElement;

const treeView = new TreeView(systemsPaneElt.querySelector(".tree-view-container") as HTMLDivElement);

systemsPaneElt.querySelector(".registry .actions .refresh").addEventListener("click", () => {
  refreshRegistry();
});

let serverProcess: ChildProcess;

function refreshRegistry() {
  if (serverProcess != null) return;

  treeView.clear();

  // TODO: Disable buttons

  serverProcess = forkServerProcess([ "registry" ]);
  serverProcess.on("message", onRegistryReceived);
  serverProcess.on("exit", () => {
    // TODO: Re-enable buttons
    serverProcess = null;
  });
}

function onRegistryReceived(event: any) {
  if (event.type !== "registry") {
    // TODO: Whoops?! Handle error?
    return;
  }

  const systemsByName = event.registry.systems;

  for (const systemName in systemsByName) {
    const system = systemsByName[systemName];

    const systemElt = html("li");
    const local = system.localVersion != null ? `Installed: v${system.localVersion}` : "Not Installed";
    html("div", "label", { parent: systemElt, textContent: `${systemName} (Latest: v${system.version}, ${local})` });

    treeView.append(systemElt, "group");

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
