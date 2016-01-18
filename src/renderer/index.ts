/// <reference path="../../typings/tsd.d.ts" />

import * as TreeView from "dnd-tree-view";
import * as TabStrip from "tab-strip";

const sidebarElt = document.querySelector(".sidebar");


// Servers tree view
const serversTreeView = new TreeView(document.querySelector(".servers-tree-view") as HTMLElement, { dropCallback: onServerDrop });
serversTreeView.on("selectionChange", updateSelectedServer);
serversTreeView.on("activate", onServerActivate);

const myServerElt = document.createElement("li");
myServerElt.textContent = "My Server";
serversTreeView.append(myServerElt, "item");

function onServerDrop(dropInfo: { target: HTMLLIElement; where: string; }, orderedNodes: HTMLLIElement[]) {
  // TODO
  return false;
}

function updateSelectedServer() {
  // TODO
}

function onServerActivate() {
  // TODO
}

// Tab strip
const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
const tabStrip = new TabStrip(tabsBarElt);
tabStrip.on("activateTab", onTabActivate);
tabStrip.on("closeTab", onTabClose);

const homeTabElt = document.createElement("li");
homeTabElt.textContent = "H";
homeTabElt.classList.add("active");
homeTabElt.classList.add("pinned");

tabStrip.tabsRoot.appendChild(homeTabElt);

function onTabActivate(tabElement: HTMLLIElement) {
  // TODO
}

function onTabClose(tabElement: HTMLLIElement) {
  // TODO
}

// Panes
const panesElt = document.querySelector(".panes");

const homeIframeElt = document.createElement("iframe");
homeIframeElt.src = "http://superpowers-html5.com/";
panesElt.appendChild(homeIframeElt);