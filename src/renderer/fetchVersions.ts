import * as async from "async";
import fetch from "../shared/fetch";

interface ComponentInfo {
  repository: string;
  version: string;
}

interface FetchVersionsCallback {
  (err: Error, components: { [name: string]: ComponentInfo }): void;
}

export default function fetchVersions(callback: FetchVersionsCallback) {
  const components: { [name: string]: ComponentInfo } = {
    "app": { repository: "superpowers/superpowers-launcher", version: null },
    "server": { repository: "superpowers/superpowers", version: null }
  };

  // TODO: Check the various installed systems too

  async.each(Object.keys(components), (name, cb) => {
    fetch(`https://api.github.com/repos/${components[name].repository}/releases/latest`, "json", (err, lastRelease) => {
      if (err != null) { cb(err); return; }
      components[name].version = lastRelease.tag_name as string;
      cb();
    });
  }, (err) => {
    callback(err, components);
  });
}
