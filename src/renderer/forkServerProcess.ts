import { fork } from "child_process";
import * as settings from "./settings";

export default function forkSererProcess(extraArgs: string[] = []) {
  const serverPath = `${settings.corePath}/server/index.js`;

  const serverEnv: { [key: string]: string; } = {};
  serverEnv["ELECTRON_RUN_AS_NODE"] = "1";
  serverEnv["ELECTRON_NO_ATTACH_CONSOLE"] = "1";

  // NOTE: It would be nice to simply copy all environment variables
  // but somehow, this prevents Electron 0.35.1 from starting the server
  // for (const key in nodeProcess.env) serverEnv[key] = nodeProcess.env[key];

  // So instead, we'll just copy the environment variables we definitely need
  for (const varName of [ "NODE_ENV", "APPDATA", "HOME", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "LD_LIBRARY_PATH", "GST_PLUGIN_SYSTEM_PATH", "XDG_CONFIG_DIRS", "PATH", "GI_TYPELIB_PATH" ]) {
    if (process.env[varName] != null) serverEnv[varName] = process.env[varName];
  }

  const serverProcess = fork(
    serverPath,
    [ `--data-path=${settings.roUserDataPath}`, `--rw-data-path=${settings.rwUserDataPath}` ].concat(extraArgs),
    { silent: true, env: serverEnv }
  );
  return serverProcess;
}
