import * as path from "path";
import * as fs from "fs";
import * as electron from "electron";
import { LocalizedError } from "./shared/I18n";

export default function(callback: (err: LocalizedError, dataPath?: string, languageCode?: string) => void) {
  let dataPathErr: LocalizedError;
  let dataPath: string;

  switch (process.platform) {
    case "win32":
      if (process.env.APPDATA != null) dataPath = path.join(process.env.APPDATA, "Superpowers");
      else dataPathErr = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "APPDATA" });
      break;
    case "darwin":
      if (process.env.HOME != null) dataPath = path.join(process.env.HOME, "Library", "Superpowers");
      else dataPathErr = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "HOME" });
      break;
    default:
      if (process.env.XDG_DATA_HOME != null) dataPath = path.join(process.env.XDG_DATA_HOME, "Superpowers");
      else if (process.env.HOME != null) dataPath = path.join(process.env.HOME, ".local/share", "Superpowers");
      else dataPathErr = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "XDG_DATA_HOME, HOME" });
  }

  if (dataPathErr != null) {
    process.nextTick(() => { callback(dataPathErr); });
    return;
  }

  fs.mkdir(dataPath, (err) => {
    if (err != null && err.code !== "EEXIST") {
      callback(new LocalizedError("startup:errors.couldNotCreateUserDataFolder", { dataPath, reason: err.message }));
      return;
    }

    fs.readFile(`${dataPath}/settings.json`, { encoding: "utf8" }, (err, settingsJSON) => {
      const languageCode = (settingsJSON != null) ? JSON.parse(settingsJSON).languageCode : null;
      callback(null, dataPath, languageCode);
    });
  });
}
