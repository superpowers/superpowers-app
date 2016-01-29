import * as TabStrip from "tab-strip";

const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
const panesElt = document.querySelector(".panes");
const tabStrip = new TabStrip(tabsBarElt);

const homeTabElt = document.createElement("li");
homeTabElt.dataset["name"] = "home";
homeTabElt.classList.add("active", "pinned");
tabStrip.tabsRoot.appendChild(homeTabElt);

export function openServer(serverEntry: ServerEntry) {
  clearActiveTab();

  let serverTabElt = tabsBarElt.querySelector(`li[data-server-id="${serverEntry.id}"]`) as HTMLLIElement;
  let serverPaneElt = panesElt.querySelector(`iframe[data-server-id="${serverEntry.id}"]`) as HTMLIFrameElement;

  if (serverTabElt == null) {
    serverTabElt = document.createElement("li");
    serverTabElt.dataset["serverId"] = serverEntry.id;
    serverTabElt.textContent = serverEntry.label;
    tabStrip.tabsRoot.appendChild(serverTabElt);

    serverPaneElt = document.createElement("iframe");
    serverPaneElt.dataset["serverId"] = serverEntry.id;

    const host = serverEntry.hostname + (serverEntry.port != null ? `:${serverEntry.port}` : "");
    // TODO: Check if server the server is online and if it's a Superpowers server (fetch superpowers.json)
    serverPaneElt.src = `http://${host}`;
    panesElt.appendChild(serverPaneElt);
  }

  serverTabElt.classList.add("active");
  serverPaneElt.classList.add("active");
}


tabStrip.on("activateTab", onTabActivate);
tabStrip.on("closeTab", onTabClose);

function onTabActivate(tabElt: HTMLLIElement) {
  clearActiveTab();

  tabElt.classList.add("active");
  const serverId = tabElt.dataset["serverId"];
  const paneName = tabElt.dataset["name"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`iframe[data-server-id="${serverId}"]`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`*[data-name="${paneName}"]`) as HTMLIFrameElement;
  paneElt.classList.add("active");
}

function onTabClose(tabElement: HTMLLIElement) {
  if (tabElement.classList.contains("pinned")) return;

  const serverId = tabElement.dataset["serverId"];
  const paneName = tabElement.dataset["pane"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`iframe[data-server-id='${serverId}']`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`*[data-name='${paneName}']`) as HTMLIFrameElement;

  if (tabElement.classList.contains("active")) {
    const activeTabElement = (tabElement.nextElementSibling != null) ? tabElement.nextElementSibling as HTMLLIElement : tabElement.previousElementSibling as HTMLLIElement;
    if (activeTabElement != null) onTabActivate(activeTabElement);
  }

  tabElement.parentElement.removeChild(tabElement);
  paneElt.parentElement.removeChild(paneElt);
}

function clearActiveTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement;
  if (activeTabElt != null) {
    activeTabElt.classList.remove("active");
    (panesElt.querySelector(".active") as HTMLElement).classList.remove("active");
  }
}
