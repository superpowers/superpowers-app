import * as yargs from "yargs";
import * as path from "path";
import * as fs from "fs";
import { LocalizedError } from "./shared/i18n";

const argv = yargs
  .usage("Usage: $0 [options]")
  .describe("core-path", "Path to Superpowers core")
  .argv;

export default function getPaths(callback: (err: LocalizedError, corePath?: string, dataPath?: string) => void) {
  let error: LocalizedError;
  let dataPath: string;

  let corePath = argv["core-path"] != null ? path.resolve(argv["core-path"]) : null;
  if (corePath != null) {
    dataPath = corePath;
    process.nextTick(() => { callback(null, corePath, dataPath); });
    return;
  }

  switch (process.platform) {
    case "win32":
      if (process.env.APPDATA != null) dataPath = path.join(process.env.APPDATA, "Superpowers");
      else error = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "APPDATA" });
      break;
    case "darwin":
      if (process.env.HOME != null) dataPath = path.join(process.env.HOME, "Library", "Superpowers");
      else error = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "HOME" });
      break;
    default:
      if (process.env.XDG_DATA_HOME != null) dataPath = path.join(process.env.XDG_DATA_HOME, "Superpowers");
      else if (process.env.HOME != null) dataPath = path.join(process.env.HOME, ".local/share", "Superpowers");
      else error = new LocalizedError("startup:errors.missingEnvironmentVariables", { envVars: "XDG_DATA_HOME, HOME" });
  }

  if (error != null) {
    process.nextTick(() => { callback(error); });
    return;
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
