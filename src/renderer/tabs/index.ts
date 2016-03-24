import * as TabStrip from "tab-strip";

const tabsBarElt = document.querySelector(".tabs-bar") as HTMLElement;
export const tabStrip = new TabStrip(tabsBarElt);
export const panesElt = document.querySelector(".panes");

tabStrip.on("activateTab", onActivateTab);
tabStrip.on("closeTab", onCloseTab);
tabStrip.tabsRoot.addEventListener("click", onTabStripClick);

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const ctrlOrCmd = event.ctrlKey || event.metaKey;

  if (event.keyCode === 87 && ctrlOrCmd) { // Ctrl+W
    onCloseTab(tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement);
  }

  if (event.keyCode === 9 && event.ctrlKey) { // Ctrl+Tab
    event.preventDefault();
    if (event.shiftKey) onActivatePreviousTab();
    else onActivateNextTab();
  }
});


export function clearActiveTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector("li.active") as HTMLLIElement;
  if (activeTabElt != null) {
    activeTabElt.classList.remove("active");
    (panesElt.querySelector(":scope > *:not([hidden])") as HTMLElement).hidden = true;
  }
}

export function onActivateTab(tabElt: HTMLLIElement) {
  clearActiveTab();

  tabElt.classList.add("active");
  const serverId = tabElt.dataset["serverId"];
  const paneName = tabElt.dataset["name"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`:scope > iframe[data-server-id="${serverId}"]`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`:scope > *[data-name="${paneName}"]`) as HTMLIFrameElement;
  paneElt.hidden = false;
}

function onCloseTab(tabElement: HTMLLIElement) {
  if (tabElement.classList.contains("pinned")) return;

  const serverId = tabElement.dataset["serverId"];
  const paneName = tabElement.dataset["name"];

  let paneElt: HTMLElement;
  if (serverId != null) paneElt = panesElt.querySelector(`iframe[data-server-id='${serverId}']`) as HTMLIFrameElement;
  else paneElt = panesElt.querySelector(`*[data-name='${paneName}']`) as HTMLIFrameElement;

  if (tabElement.classList.contains("active")) {
    const activeTabElement = (tabElement.nextElementSibling != null) ? tabElement.nextElementSibling as HTMLLIElement : tabElement.previousElementSibling as HTMLLIElement;
    if (activeTabElement != null) onActivateTab(activeTabElement);
  }

  tabElement.parentElement.removeChild(tabElement);

  if (paneElt.dataset["persist"] === "true") paneElt.hidden = true;
  else paneElt.parentElement.removeChild(paneElt);
}

function onTabStripClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.tagName !== "BUTTON" || target.className !== "close") return;

  tabStrip.emit("closeTab", target.parentElement as HTMLLIElement);
}

function onActivatePreviousTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector(".active");
  for (let tabIndex = 0; tabStrip.tabsRoot.children.length; tabIndex++) {
    const tabElt = tabStrip.tabsRoot.children[tabIndex];
    if (tabElt === activeTabElt) {
      const newTabIndex = (tabIndex === 0) ? tabStrip.tabsRoot.children.length - 1 : tabIndex - 1;
      onActivateTab(tabStrip.tabsRoot.children[newTabIndex] as HTMLLIElement);
      return;
    }
  }
}

function onActivateNextTab() {
  const activeTabElt = tabStrip.tabsRoot.querySelector(".active");
  for (let tabIndex = 0; tabStrip.tabsRoot.children.length; tabIndex++) {
    const tabElt = tabStrip.tabsRoot.children[tabIndex];
    if (tabElt === activeTabElt) {
      const newTabIndex = (tabIndex === tabStrip.tabsRoot.children.length - 1) ? 0 : tabIndex + 1;
      onActivateTab(tabStrip.tabsRoot.children[newTabIndex] as HTMLLIElement);
      return;
    }
  }
}
