import * as TabStrip from "tab-strip";

const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
export const tabStrip = new TabStrip(tabsBarElt);
export const panesElt = document.querySelector(".panes");

tabStrip.on("activateTab", onTabActivate);
tabStrip.on("closeTab", onTabClose);
tabStrip.tabsRoot.addEventListener("click", onTabStripClick);

export function clearActiveTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement;
  if (activeTabElt != null) {
    activeTabElt.classList.remove("active");
    (panesElt.querySelector(":scope > *:not([hidden])") as HTMLElement).hidden = true;
  }
}

export function onTabActivate(tabElt: HTMLLIElement) {
  clearActiveTab();

  tabElt.classList.add("active");
  const serverId = tabElt.dataset["serverId"];
  const paneName = tabElt.dataset["name"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`:scope > iframe[data-server-id="${serverId}"]`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`:scope > *[data-name="${paneName}"]`) as HTMLIFrameElement;
  paneElt.hidden = false;
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
