import * as electron from "electron";
import * as async from "async";
import * as fs from "fs";
import * as dialogs from "simple-dialogs";
import * as settings from "./settings";
import * as i18n from "../shared/i18n";
import * as splashScreen from "./splashScreen";
import fetch from "../shared/fetch";

export let appVersion = electron.remote.app.getVersion();
if (appVersion === "0.0.0-dev") appVersion = `v${require(`${__dirname}/../../package.json`).version}-dev`;
else appVersion = `v${appVersion}`;

interface ComponentInfo {
  repository: string;
  current: string;
  latest: string;
}

const components: { [name: string]: ComponentInfo } = {
  "app": { repository: "superpowers/superpowers-app", current: appVersion, latest: null },
  "core": { repository: "superpowers/superpowers-core", current: null, latest: null }
};

function fetchVersions(callback: (err: Error) => void) {
  // TODO: Check the various installed systems too

  fs.readFile(`${settings.userDataPath}/core/package.json`, { encoding: "utf8" }, (err, corePackageJSON) => {
    if (err != null && err.code !== "ENOENT") throw err;

    if (corePackageJSON != null) {
      const corePackage = JSON.parse(corePackageJSON);
      components["core"].current = corePackage.version;
    }

    async.each(Object.keys(components), (name, cb) => {
      fetch(`https://api.github.com/repos/${components[name].repository}/releases/latest`, "json", (err, lastRelease) => {
        if (err != null) { cb(err); return; }
        components[name].latest = lastRelease.tag_name as string;
        cb();
      });
    }, callback);
  });
}

export function checkForUpdates(callback: Function) {
  // TODO: Offer installing a system on first run!
  async.series([ fetchVersions, checkAppUpdate, checkCoreUpdate ],
  (err) => { callback(); });
}

function checkAppUpdate(callback: Function) {
  const app = components["app"];
  if (electron.remote.app.getVersion() === "0.0.0-dev") { callback(); return; }
  if (app.latest == null || app.latest === app.current) { callback(); return; }

  const label = i18n.t("startup:updateAvailable.app", { latest: app.latest, current: app.current });
  const options = {
    validationLabel: i18n.t("common:actions.download"),
    cancelLabel: i18n.t("common:actions.skip")
  };

  new dialogs.ConfirmDialog(label, options, (shouldDownload) => {
    if (shouldDownload) {
      electron.shell.openExternal("http://superpowers-html5.com/");
      electron.remote.app.quit();
      return;
    }

    callback();
  });
}

function checkCoreUpdate(callback: Function) {
  const core = components["core"];
  if (core.latest == null || core.latest === core.current) { callback(); return; }

  if (core.current == null) {
    installCore(callback);
    return;
  }

  const label = i18n.t("startup:updateAvailable.core", { latest: core.latest, current: core.current });
  const options = {
    validationLabel: i18n.t("common:actions.update"),
    cancelLabel: i18n.t("common:actions.skip")
  };

  new dialogs.ConfirmDialog(label, options, (shouldUpdate) => {
    if (shouldUpdate) { installCore(callback); return; }
    callback();
  });

  return;
}

function installCore(callback: Function) {
  splashScreen.setStatus(i18n.t("startup:status.installingCore"));

  // TODO: Actually install core
  setTimeout(callback, 1000);
}
