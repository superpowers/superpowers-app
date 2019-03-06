import * as electron from "electron";
import * as yargs from "yargs";
import * as path from "path";
import * as fs from "fs";
import { LocalizedError } from "./shared/i18n";

const argv = yargs
  .usage("Usage: $0 [options]")
  .describe("core-path", "Path to Superpowers core")
  .argv;

export default function getPaths(callback: (err: LocalizedError, corePath?: string, dataPath?: string) => void) {
  let dataPath: string;

  let corePath = argv["core-path"] != null ? path.resolve(argv["core-path"] as string) : null;
  if (corePath != null) {
    dataPath = corePath;
    process.nextTick(() => { callback(null, corePath, dataPath); });
    return;
  }

  try {
    dataPath = path.join(electron.app.getPath("appData"), "Superpowers");
  } catch (err) {
    process.nextTick(() => { callback(new LocalizedError("startup:errors.couldNotGetDataPath", { details: err.message })); });
    return;
  }

  console.log(dataPath);

  if (!fs.existsSync(dataPath)) {
    // This is the old custom logic we used to determine the appData folder
    // so if the new data folder doesn't exist, we'll try to migrate from the old one
    let oldDataPath: string;

    switch (process.platform) {
      case "win32":
        if (process.env.APPDATA != null) oldDataPath = path.join(process.env.APPDATA, "Superpowers");
        break;
      case "darwin":
        if (process.env.HOME != null) oldDataPath = path.join(process.env.HOME, "Library", "Superpowers");
        break;
      default:
        if (process.env.XDG_DATA_HOME != null) oldDataPath = path.join(process.env.XDG_DATA_HOME, "Superpowers");
        else if (process.env.HOME != null) oldDataPath = path.join(process.env.HOME, ".local/share", "Superpowers");
    }

    if (oldDataPath != null && fs.existsSync(oldDataPath)) {
      console.log(`Migrating data from ${oldDataPath} to ${dataPath}...`);
      fs.renameSync(oldDataPath, dataPath);
    }
  }

  corePath = path.join(dataPath, "core");

  fs.mkdir(dataPath, (err) => {
    if (err != null && err.code !== "EEXIST") {
      callback(new LocalizedError("startup:errors.couldNotCreateUserDataFolder", { dataPath, reason: err.message }));
      return;
    }

    callback(null, corePath, dataPath);
  });
}
