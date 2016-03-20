import * as fs from "fs";
import * as electron from "electron";
import * as i18n from "./shared/i18n";

export default function getLanguageCode(dataPath: string, callback: (languageCode: string) => void) {
  fs.readFile(`${dataPath}/settings.json`, { encoding: "utf8" }, (err, settingsJSON) => {
    let languageCode = (settingsJSON != null) ? JSON.parse(settingsJSON).languageCode : null;

    if (languageCode == null) languageCode = electron.app.getLocale();
    if (i18n.languageIds.indexOf(languageCode) === -1 && languageCode.indexOf("-") !== -1) languageCode = languageCode.split("-")[0];
    if (i18n.languageIds.indexOf(languageCode) === -1) languageCode = "en";

    callback(languageCode);
  });
}
