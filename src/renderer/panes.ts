import * as TabStrip from "tab-strip";
import * as i18n from "../shared/i18n";

const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
const panesElt = document.querySelector(".panes");
const tabStrip = new TabStrip(tabsBarElt);

export function openServer(serverEntry: ServerEntry) {
  clearActiveTab();

  let serverTabElt = tabsBarElt.querySelector(`li[data-server-id="${serverEntry.id}"]`) as HTMLLIElement;
  let serverPaneElt = panesElt.querySelector(`iframe[data-server-id="${serverEntry.id}"]`) as HTMLIFrameElement;

  if (serverTabElt == null) {
    serverTabElt = document.createElement("li");
    serverTabElt.dataset["serverId"] = serverEntry.id;

    const iconElt = document.createElement("img");
    iconElt.className = "icon";
    iconElt.src = "images/tabs/server.svg";
    serverTabElt.appendChild(iconElt);

    const labelElt = document.createElement("div");
    labelElt.className = "label";

    const locationElt = document.createElement("div");
    locationElt.className = "location";
    locationElt.textContent = `${serverEntry.hostname}:${serverEntry.port}`;
    labelElt.appendChild(locationElt);

    const nameElt = document.createElement("div");
    nameElt.className = "name";
    nameElt.textContent = serverEntry.label;
    labelElt.appendChild(nameElt);

    serverTabElt.appendChild(labelElt);

    const closeButton = document.createElement("button");
    closeButton.className = "close";
    serverTabElt.appendChild(closeButton);

    tabStrip.tabsRoot.appendChild(serverTabElt);

    serverPaneElt = document.createElement("iframe");
    serverPaneElt.dataset["serverId"] = serverEntry.id;

    const host = serverEntry.hostname + (serverEntry.port != null ? `:${serverEntry.port}` : "");

    // TODO: Check if the server is online and if it's a Superpowers server (fetch superpowers.json)
    serverPaneElt.src = `http://${host}`;
    panesElt.appendChild(serverPaneElt);
  }

  serverTabElt.classList.add("active");
  serverPaneElt.classList.add("active");
}

export function openServerSettings() {
  clearActiveTab();

  let serverSettingsTabElt = tabsBarElt.querySelector(`li[data-name="server-settings"]`) as HTMLLIElement;
  if (serverSettingsTabElt == null) {
    serverSettingsTabElt = document.createElement("li");
    serverSettingsTabElt.dataset["name"] = "server-settings";

    const iconElt = document.createElement("img");
    iconElt.className = "icon";
    iconElt.src = "images/tabs/serverSettings.svg";
    serverSettingsTabElt.appendChild(iconElt);

    const labelElt = document.createElement("div");
    labelElt.className = "label";
    labelElt.textContent = i18n.t("server:settings.title");
    serverSettingsTabElt.appendChild(labelElt);

    const closeButton = document.createElement("button");
    closeButton.className = "close";
    serverSettingsTabElt.appendChild(closeButton);

    tabStrip.tabsRoot.appendChild(serverSettingsTabElt);
  }
  const serverSettingsPaneElt = panesElt.querySelector(`div[data-name="server-settings"]`) as HTMLIFrameElement;

  serverSettingsTabElt.classList.add("active");
  serverSettingsPaneElt.classList.add("active");
}

tabStrip.on("activateTab", onTabActivate);
tabStrip.on("closeTab", onTabClose);
tabStrip.tabsRoot.addEventListener("click", onTabStripClick);

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
  const paneName = tabElement.dataset["name"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`iframe[data-server-id='${serverId}']`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`*[data-name='${paneName}']`) as HTMLIFrameElement;

  if (tabElement.classList.contains("active")) {
    const activeTabElement = (tabElement.nextElementSibling != null) ? tabElement.nextElementSibling as HTMLLIElement : tabElement.previousElementSibling as HTMLLIElement;
    if (activeTabElement != null) onTabActivate(activeTabElement);
  }

  tabElement.parentElement.removeChild(tabElement);

  if (paneElt.dataset["persist"] === "true") paneElt.classList.remove("active");
  else paneElt.parentElement.removeChild(paneElt);
}

function onTabStripClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.tagName !== "BUTTON" || target.className !== "close") return;

  onTabClose(target.parentElement as HTMLLIElement);
}

function clearActiveTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement;
  if (activeTabElt != null) {
    activeTabElt.classList.remove("active");
    (panesElt.querySelector(".active") as HTMLElement).classList.remove("active");
  }
}
