import { tabStrip, panesElt, clearActiveTab } from "./index";

export default function openServer(serverEntry: ServerEntry) {
  clearActiveTab();

  let serverTabElt = tabStrip.tabsRoot.querySelector(`li[data-server-id="${serverEntry.id}"]`) as HTMLLIElement;
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
  serverPaneElt.hidden = false;
}

