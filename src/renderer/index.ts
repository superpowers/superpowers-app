/// <reference path="../../typings/tsd.d.ts" />

import * as TreeView from "dnd-tree-view";
import * as TabStrip from "tab-strip";
import * as ResizeHandle from "resize-handle";

const sidebarElt = document.querySelector(".sidebar");
const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
const tabStrip = new TabStrip(tabsBarElt);
const panesElt = document.querySelector(".panes");

new ResizeHandle(document.querySelector(".sidebar") as HTMLDivElement, "left");

// Servers tree view
const serversTreeView = new TreeView(document.querySelector(".servers-tree-view") as HTMLElement, { dropCallback: onServerDrop });
serversTreeView.on("selectionChange", updateSelectedServer);
serversTreeView.on("activate", onServerActivate);

const myServerElt = document.createElement("li");
myServerElt.textContent = "My Server";
myServerElt.dataset["serverId"] = "0";
serversTreeView.append(myServerElt, "item");

function onServerDrop(dropInfo: { target: HTMLLIElement; where: string; }, orderedNodes: HTMLLIElement[]) {
  // TODO
  return false;
}

function updateSelectedServer() {
  if (serversTreeView.selectedNodes.length === 0) {
    // TODO
  } else {
    // TODO
  }
}

function onServerActivate() {
  if (serversTreeView.selectedNodes.length === 0) return;

  let serverId = serversTreeView.selectedNodes[0].dataset["serverId"];
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
    serverTabElt = document.createElement("li");
    serverTabElt.dataset["serverId"] = serverId;
    serverTabElt.textContent = "My Server";
    tabStrip.tabsRoot.appendChild(serverTabElt);

    serverIframeElt = document.createElement("iframe");
    serverIframeElt.dataset["serverId"] = serverId;
    serverIframeElt.src = "http://localhost:8000/";
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
  // TODO
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
