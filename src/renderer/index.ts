/// <reference path="../../typings/tsd.d.ts" />

import * as electron from "electron";
import * as fs from "fs";
import * as path from "path";
import * as TreeView from "dnd-tree-view";
import * as TabStrip from "tab-strip";
import * as ResizeHandle from "resize-handle";
import { InfoDialog, ConfirmDialog } from "simple-dialogs";

import AddAddOrEditServerDialog, { AddOrEditServerResult } from "./AddOrEditServerDialog";

const sidebarElt = document.querySelector(".sidebar");
const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
const tabStrip = new TabStrip(tabsBarElt);
const panesElt = document.querySelector(".panes");

new ResizeHandle(document.querySelector(".sidebar") as HTMLDivElement, "left");

interface ServerData extends AddOrEditServerResult { id: string; }
let favoritesPath: string;
let favorites: {
  servers: ServerData[];
  projects: { address: string; name: string }[];
};
let serversById: { [id: string]: ServerData } = {};

// Servers tree view
const addServerBtn = document.querySelector(".add-server") as HTMLButtonElement;
addServerBtn.addEventListener("click", (event) => {
  const addOrEditOptions = {
    validationLabel: "Add",
    initialAddressValue: "127.0.0.1",
    initialPortValue: "4237",
    initialLabelValue: ""
  }
  new AddAddOrEditServerDialog("Enter the server details", addOrEditOptions, (newServer: ServerData) => {
    if (newServer == null) return;

    let id = 0;
    for (const server of favorites.servers) id = Math.max(id, parseInt(server.id, 10) + 1);
    newServer.id = id.toString();

    addServer(newServer);
    favorites.servers.push(newServer);
    serversById[newServer.id] = newServer;
    fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2), { encoding: "utf8" });
  });
})

const editServerBtn = document.querySelector(".edit-server") as HTMLButtonElement;
editServerBtn.addEventListener("click", (event) => {
  const selectedServerId = parseInt(serversTreeView.selectedNodes[0].dataset["serverId"], 10);
  const selectedServer = serversById[selectedServerId];

  const addOrEditOptions = {
    validationLabel: "Edit",
    initialAddressValue: selectedServer.address,
    initialPortValue: selectedServer.port,
    initialLabelValue: selectedServer.label
  }
  new AddAddOrEditServerDialog("Edit the server details", addOrEditOptions, (server) => {
    if (server == null) return;

    const selectedServerElt = serversTreeView.treeRoot.querySelector(`li[data-server-id="${selectedServerId}"]`);

    selectedServer.address = server.address;
    selectedServer.port = server.port;

    let address = server.address;
    if (server.port != null) address += `:${server.port}`;
    selectedServerElt.querySelector(".address").textContent = address

    selectedServer.label = server.label;
    selectedServerElt.querySelector(".label").textContent = server.label;

    fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2), { encoding: "utf8" });
  });
})

const removeServerBtn = document.querySelector(".remove-server") as HTMLButtonElement;
removeServerBtn.addEventListener("click", (event) => {
  new ConfirmDialog("Are you sure you want to remove the server?", { validationLabel: "Remove" }, (confirm) => {
    if (!confirm) return;

    const selectedServerId = serversTreeView.selectedNodes[0].dataset["serverId"];
    const selectedServerElt = serversTreeView.treeRoot.querySelector(`li[data-server-id="${selectedServerId}"]`);
    serversTreeView.treeRoot.removeChild(selectedServerElt);
    
    serversById[selectedServerId] = null;
    for (let index = 0; index < favorites.servers.length; index++) {
      const server = favorites.servers[index];
      if (server.id === selectedServerId) {
        favorites.servers.splice(index, 1);
        break;
      }
    }
    fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2), { encoding: "utf8" });
  });
})

const serversTreeView = new TreeView(document.querySelector(".servers-tree-view") as HTMLElement, { dropCallback: onServerDrop });
serversTreeView.on("selectionChange", updateSelectedServer);
serversTreeView.on("activate", onServerActivate);

function addServer(server: ServerData) {
  const serverElt = document.createElement("li");
  serverElt.dataset["serverId"] = server.id;
  serversTreeView.append(serverElt, "item");

  const addressElt = document.createElement("span");
  addressElt.classList.add("address");
  let address = server.address;
  if (server.port != null) address += `:${server.port}`;
  addressElt.textContent = address;
  serverElt.appendChild(addressElt);

  const labelElt = document.createElement("span");
  labelElt.classList.add("label");
  labelElt.textContent = server.label;
  serverElt.appendChild(labelElt);
}

function onServerDrop(dropInfo: { target: HTMLLIElement; where: string; }, orderedNodes: HTMLLIElement[]) {
  // TODO
  return false;
}

function updateSelectedServer() {
  if (serversTreeView.selectedNodes.length === 0) {
    editServerBtn.disabled = true;
    removeServerBtn.disabled = true;
  } else {
    editServerBtn.disabled = false;
    removeServerBtn.disabled = false;
  }
}

function onServerActivate() {
  if (serversTreeView.selectedNodes.length === 0) return;

  const serverId = serversTreeView.selectedNodes[0].dataset["serverId"];
  openServer(serverId);
}

function openServer(serverId: string) {
  const activeTabElt = tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement;
  if (activeTabElt != null) {
    activeTabElt.classList.remove("active");
    (panesElt.querySelector("iframe.active") as HTMLIFrameElement).classList.remove("active");
  }

  let serverTabElt = tabsBarElt.querySelector(`li[data-server-id="${serverId}"]`) as HTMLLIElement;
  let serverIframeElt = panesElt.querySelector(`iframe[data-server-id="${serverId}"]`) as HTMLIFrameElement;

  if (serverTabElt == null) {
    const server = serversById[serverId];

    serverTabElt = document.createElement("li");
    serverTabElt.dataset["serverId"] = serverId;
    serverTabElt.textContent = server.label;
    tabStrip.tabsRoot.appendChild(serverTabElt);

    serverIframeElt = document.createElement("iframe");
    serverIframeElt.dataset["serverId"] = serverId;
    let address = server.address;
    if (server.port != null) address += `:${server.port}`;
    // FIXME: check if server the server is online and if it's a superpowers server (fetch superpowers.json)
    serverIframeElt.src = `http://${address}`;
    panesElt.appendChild(serverIframeElt);
  }

  serverTabElt.classList.add("active");
  serverIframeElt.classList.add("active");
}

// Tab strip
tabStrip.on("activateTab", onTabActivate);
tabStrip.on("closeTab", onTabClose);

function onTabActivate(serverTabElt: HTMLLIElement) {
  const activeTab = tabStrip.tabsRoot.querySelector(".active");
  if (activeTab != null) {
    activeTab.classList.remove("active");
    (panesElt.querySelector("iframe.active") as HTMLIFrameElement).classList.remove("active");
  }

  serverTabElt.classList.add("active");
  const serverId = serverTabElt.dataset["serverId"];
  const toolName = serverTabElt.dataset["name"];

  if (serverId != null) {
    const serverIframeElt = panesElt.querySelector(`iframe[data-server-id="${serverId}"]`) as HTMLIFrameElement;
    serverIframeElt.classList.add("active");
  } else {
    const toolIframeElt = panesElt.querySelector(`iframe[data-name="${toolName}"]`) as HTMLIFrameElement;
    toolIframeElt.classList.add("active");
  }
}

function onTabClose(tabElement: HTMLLIElement) {
  const serverId = tabElement.dataset["serverId"];
  let frameElt: HTMLIFrameElement;
  if (serverId != null) frameElt = panesElt.querySelector(`iframe[data-server-id='${serverId}']`) as HTMLIFrameElement;
  else {
    if (tabElement.classList.contains("pinned")) return;
    const toolName = tabElement.dataset["pane"];
    frameElt = panesElt.querySelector(`iframe[data-name='${toolName}']`) as HTMLIFrameElement;
  }

  if (tabElement.classList.contains("active")) {
    const activeTabElement = (tabElement.nextElementSibling != null) ? tabElement.nextElementSibling as HTMLLIElement : tabElement.previousElementSibling as HTMLLIElement;
    if (activeTabElement != null) onTabActivate(activeTabElement);
  }

  tabElement.parentElement.removeChild(tabElement);
  frameElt.parentElement.removeChild(frameElt);
}

// Home tab
const homeTabElt = document.createElement("li");
homeTabElt.textContent = "H";
homeTabElt.dataset["name"] = "home";
homeTabElt.classList.add("active");
homeTabElt.classList.add("pinned");
tabStrip.tabsRoot.appendChild(homeTabElt);

const homeIframeElt = document.createElement("iframe");
homeIframeElt.src = "http://superpowers-html5.com/";
homeIframeElt.classList.add("active");
homeIframeElt.dataset["name"] = "home";
panesElt.appendChild(homeIframeElt);

// Load favorites
electron.ipcRenderer.on("userDataPath", (sender, userDataPath) => {
  favoritesPath = path.join(userDataPath, "favorites.json");

  fs.readFile(favoritesPath, { encoding: "utf8"}, (err, data) => {
    if (err != null) {
      if (err.code === "ENOENT") favorites = { servers: [ { address: "127.0.0.1", port: "4237", label: "My Server", id: "0" } ], projects: [] };
      else { new InfoDialog(err.message); return; }
    } else {
      favorites = JSON.parse(data);
    }

    for (const server of favorites.servers) {
      addServer(server);
      serversById[server.id] = server;
    }
    addServerBtn.disabled = false;
  })
})

window.addEventListener("message", (event) => {
  if (event.data.type === "open-project") electron.ipcRenderer.send("new-standalone-window", event.data.address, event.data.name);
});
