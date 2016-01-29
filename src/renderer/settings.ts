import * as fs from "fs";
import * as i18n from "../shared/i18n";

export let settingsPath: string;

export let favoriteServers: ServerEntry[];
export let favoriteServersById: { [id: string]: ServerEntry };

export let recentProjects: { host: string; projectId: string; name: string; }[];

export function load(path: string, callback: (err: i18n.LocalizedError) => void) {
  settingsPath = path;
  console.log(`Loading settings from ${settingsPath}...`);

  fs.readFile(settingsPath, { encoding: "utf8" }, (err, dataJSON) => {
    if (err != null && err.code !== "ENOENT") {
      callback(new i18n.LocalizedError("settings:errors.couldNotLoad", { reason: err.message }));
      return;
    }

    favoriteServersById = {};
    recentProjects = [];

    if (dataJSON == null) {
      // Setup defaults
      const myServerEntry = { hostname: "127.0.0.1", port: "4237", label: i18n.t("settings:myServer"), id: "0" };
      favoriteServers = [ myServerEntry ];
      favoriteServersById[myServerEntry.id] = myServerEntry;

      callback(null);
      return;
    }

    const data = JSON.parse(dataJSON);
    favoriteServers = data.favoriteServers;
    for (const entry of favoriteServers) favoriteServersById[entry.id] = entry;
    recentProjects = data.recentProjects;

    callback(null);
  });
}

// TODO: Schedule a save with a short timeout if one isn't already planned, rather than saving right away
export function scheduleSave() {
  const data = {
    favoriteServers,
    recentProjects
  };

  fs.writeFile(settingsPath, JSON.stringify(data, null, 2), { encoding: "utf8" });
}
