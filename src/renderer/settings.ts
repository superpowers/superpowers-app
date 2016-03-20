import * as fs from "fs";
import * as i18n from "../shared/i18n";

export let corePath: string;
export let userDataPath: string;

export let favoriteServers: ServerEntry[];
export let favoriteServersById: { [id: string]: ServerEntry };

export let recentProjects: { host: string; projectId: string; name: string; }[];
export let autoStartServer: boolean;

export function load(callback: (err: Error) => void) {
  const settingsPath = `${userDataPath}/settings.json`;
  console.log(`Loading settings from ${settingsPath}...`);

  fs.readFile(settingsPath, { encoding: "utf8" }, (err, dataJSON) => {
    if (err != null && err.code !== "ENOENT") {
      callback(err);
      return;
    }

    favoriteServersById = {};
    recentProjects = [];

    if (dataJSON == null) {
      // Setup defaults
      const myServerEntry = { hostname: "127.0.0.1", port: "4237", label: i18n.t("server:myServer"), id: "0" };
      favoriteServers = [ myServerEntry ];
      favoriteServersById[myServerEntry.id] = myServerEntry;

      recentProjects = [];
      autoStartServer = true;

      callback(null);
      return;
    }

    const data = JSON.parse(dataJSON);
    favoriteServers = data.favoriteServers;
    for (const entry of favoriteServers) favoriteServersById[entry.id] = entry;
    recentProjects = data.recentProjects;
    autoStartServer = data.autoStartServer;

    callback(null);
  });
}

// TODO: Schedule a save with a short timeout if one isn't already planned, rather than saving right away
export function scheduleSave() {
  const data = {
    favoriteServers,
    recentProjects,
    autoStartServer
  };

  fs.writeFile(`${userDataPath}/settings.json`, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8" });
}
