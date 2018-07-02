import * as electron from "electron";
import * as yargs from "yargs";
import * as path from "path";
import * as fs from "fs";
import { LocalizedError } from "./shared/i18n";

const argv = yargs
  .usage("Usage: $0 [options]")
  .describe("core-path", "Path to Superpowers core")
  .describe("ro-data-path", "Path to Superpowers readonly data (used only when core-path is passed too, use '<default>' to get the default electron app appData directory. Falls back to core-path.")
  .describe("rw-data-path", "Path to Superpowers writable data (used only when core-path is passed too, use '<default>' to get the default electron app appData directory. Falls back to core-path.")
  .argv;

export default function getPaths(callback: (err: LocalizedError, corePath?: string, roDataPath?: string, rwDataPath?: string) => void) {
  let roDataPath: string;
  let rwDataPath: string;

  let corePath = argv["core-path"] != null ? path.resolve(argv["core-path"]) : null;
  if (corePath != null) {
    roDataPath = argv["ro-data-path"] != null ? argv["ro-data-path"] : corePath;
    if (roDataPath === "<default>") {
      roDataPath = path.join(electron.app.getPath("appData"), "Superpowers");
    } else {
      roDataPath = path.resolve(roDataPath);
    }

    rwDataPath = argv["rw-data-path"] != null ? argv["rw-data-path"] : corePath;
    if (rwDataPath === "<default>") {
      rwDataPath = path.join(electron.app.getPath("appData"), "Superpowers");
    } else {
      rwDataPath = path.resolve(rwDataPath);
    }

    process.nextTick(() => { callback(null, corePath, roDataPath, rwDataPath); });
    return;
  }

  try {
    roDataPath = rwDataPath = path.join(electron.app.getPath("appData"), "Superpowers");
  } catch (err) {
    process.nextTick(() => { callback(new LocalizedError("startup:errors.couldNotGetDataPath", { details: err.message })); });
    return;
  }

  console.log(roDataPath);
  console.log(rwDataPath);

  if (!fs.existsSync(rwDataPath)) {
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
      console.log(`Migrating data from ${oldDataPath} to ${rwDataPath}...`);
      fs.renameSync(oldDataPath, rwDataPath);
    }
  }

  corePath = path.join(roDataPath, "core");

  fs.mkdir(rwDataPath, (err) => {
    if (err != null && err.code !== "EEXIST") {
      callback(new LocalizedError("startup:errors.couldNotCreateUserDataFolder", { rwDataPath, reason: err.message }));
      return;
    }

    callback(null, corePath, roDataPath, rwDataPath);
  });
}
