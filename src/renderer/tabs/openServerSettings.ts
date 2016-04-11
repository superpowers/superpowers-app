import * as i18n from "../../shared/i18n";
import { tabStrip, panesElt, clearActiveTab } from "./index";

export default function openServerSettings() {
  clearActiveTab();

  let serverSettingsTabElt = tabStrip.tabsRoot.querySelector(`li[data-name="server-settings"]`) as HTMLLIElement;
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

  const serverSettingsPaneElt = panesElt.querySelector(`:scope > div[data-name="server-settings"]`) as HTMLDivElement;
  serverSettingsTabElt.classList.add("active");
  serverSettingsPaneElt.hidden = false;
}
