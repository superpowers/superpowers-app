import * as electron from "electron";
import * as async from "async";
import * as path from "path";
import * as fs from "fs";
import * as dialogs from "simple-dialogs";
import * as mkdirp from "mkdirp";
import * as dummy_https from "https";
import * as settings from "./settings";
import * as systemServerSettings from "./serverSettings/systems";
import * as i18n from "../shared/i18n";
import * as splashScreen from "./splashScreen";
import fetch from "../shared/fetch";

/* tslint:disable */
const https: typeof dummy_https = require("follow-redirects").https;
const yauzl = require("yauzl");
/* tslint:enable */

export let appVersion = electron.remote.app.getVersion();
if (appVersion === "0.0.0-dev") {
  appVersion = `v${JSON.parse(fs.readFileSync(`${__dirname}/../../package.json`, { encoding: "utf8" })).version}-dev`;
} else appVersion = `v${appVersion}`;

export function checkForUpdates(callback: (err: Error) => void) {
  async.series([ checkAppUpdate, checkUpdates ], callback);
}

function checkAppUpdate(callback: (err: Error) => void) {
  if (electron.remote.app.getVersion() === "0.0.0-dev") { callback(null); return; }

  fetch(`https://api.github.com/repos/superpowers/superpowers-app/releases/latest`, "json", (err, lastRelease) => {
    if (err != null) { callback(err); return; }
    if (lastRelease.tag_name === appVersion) { callback(null); return; }

    const label = i18n.t("startup:updateAvailable.app", { latest: lastRelease.tag_name, current: appVersion });
    const options = {
      validationLabel: i18n.t("common:actions.download"),
      cancelLabel: i18n.t("common:actions.skip")
    };

    /* tslint:disable:no-unused-expression */
    new dialogs.ConfirmDialog(label, options, (shouldDownload) => {
      /* tslint:enable:no-unused-expression */
      if (shouldDownload) {
        electron.shell.openExternal("https://github.com/superpowers/superpowers-app/releases/latest");
        electron.remote.app.quit();
        return;
      }

      callback(null);
    });
  });
}

function checkUpdates(callback: (err: Error) => void) {
  fs.readFile(`${settings.corePath}/package.json`, { encoding: "utf8" }, (err, corePackageJSON) => {
    if (err != null && err.code !== "ENOENT") throw err;

    // First installation
    if (corePackageJSON == null) {
      installCore((error) => {
        if (error != null) {
          /* tslint:disable:no-unused-expression */
          new dialogs.InfoDialog(i18n.t("startup:status.installingCoreFailed", { error: error.message }), null, () => {
            /* tslint:enable:no-unused-expression */
            callback(error);
          });
        } else {
          callback(null);
        }
      });
      return;
    }

    systemServerSettings.getRegistry((registry) => {
      async.series([
        (cb) => { updateCore(registry, cb); },
        (cb) => { updateSystemsAndPlugins(registry, cb); }
      ], callback);
    });
  });

  return;
}

export function getCoreDownloadURL(callback: (err: Error, downloadURL?: string) => any) {
  const registryUrl = "https://raw.githubusercontent.com/superpowers/superpowers-registry/master/registry.json";
  const request = https.get(registryUrl, (res) => {
    if (res.statusCode !== 200) {
      callback(new Error(`Unexpected status code: ${res.statusCode}`));
      return;
    }

    let content = "";
    res.on("data", (chunk: string) => { content += chunk; });
    res.on("end", () => {
      let registry: any;
      try { registry = JSON.parse(content); }
      catch (err) {
        callback(new Error(`Could not parse registry as JSON`));
        return;
      }

      callback(null, registry.core.downloadURL);
    });
  });

  request.on("error", (err: Error) => {
    callback(err);
  });
}

function installCore(callback: (error: Error) => void) {
  splashScreen.setStatus(i18n.t("startup:status.installingCore"));

  splashScreen.setProgressVisible(true);
  splashScreen.setProgressValue(null);

  getCoreDownloadURL((err, downloadURL) => {
    if (err != null) { callback(err); return; }

    https.get({
      hostname: "github.com",
      path: downloadURL,
      headers: { "user-agent": "Superpowers" }
    }, (res) => {
      if (res.statusCode !== 200) {
        callback(new Error(`Unexpected status code: ${res.statusCode}`));
        return;
      }

      const size = parseInt(res.headers["content-length"], 10);
      splashScreen.setProgressMax(size * 2);
      splashScreen.setProgressValue(0);
      let downloaded = 0;

      const buffers: Buffer[] = [];
      res.on("data", (data: Buffer) => { buffers.push(data); downloaded += data.length; splashScreen.setProgressValue(downloaded); });
      res.on("end", () => {
        const zipBuffer = Buffer.concat(buffers);

        yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err: Error, zipFile: any) => {
          if (err != null) throw err;

          splashScreen.setProgressMax(zipFile.entryCount * 2);
          splashScreen.setProgressValue(zipFile.entryCount);
          let entriesProcessed = 0;

          const rootFolderName = path.parse(downloadURL).name;

          zipFile.readEntry();
          zipFile.on("entry", (entry: any) => {
            if (entry.fileName.indexOf(rootFolderName) !== 0) throw new Error(`Found file outside of root folder: ${entry.fileName} (${rootFolderName})`);

            const filename = path.join(settings.corePath, entry.fileName.replace(rootFolderName, ""));
            if (/\/$/.test(entry.fileName)) {
              mkdirp(filename, (err) => {
                if (err != null) throw err;
                entriesProcessed++;
                splashScreen.setProgressValue(zipFile.entryCount + entriesProcessed);
                zipFile.readEntry();
              });
            } else {
              zipFile.openReadStream(entry, (err: Error, readStream: NodeJS.ReadableStream) => {
                if (err) throw err;

                mkdirp(path.dirname(filename), (err: Error) => {
                  if (err) throw err;
                  readStream.pipe(fs.createWriteStream(filename));
                  readStream.on("end", () => {
                    entriesProcessed++;
                    splashScreen.setProgressValue(zipFile.entryCount + entriesProcessed);
                    zipFile.readEntry();
                  });
                });
              });
            }
          });

          zipFile.on("end", () => {
            splashScreen.setProgressVisible(false);
            splashScreen.setStatus(i18n.t("startup:status.installingCoreSucceed"));
            callback(null);
          });
        });
      });
    });
  });
}

function updateCore(registry: systemServerSettings.Registry, callback: Function) {
  if (registry.core.isLocalDev || registry.core.version === registry.core.localVersion) { callback(); return; }

  const label = i18n.t("startup:updateAvailable.core", { latest: registry.core.version, current: registry.core.localVersion });
  const options = {
    validationLabel: i18n.t("common:actions.update"),
    cancelLabel: i18n.t("common:actions.skip")
  };

  /* tslint:disable:no-unused-expression */
  new dialogs.ConfirmDialog(label, options, (shouldUpdate) => {
    /* tslint:enable:no-unused-expression */
    if (!shouldUpdate) { callback(null); return; }

    splashScreen.setStatus(i18n.t("startup:status.installingCore"));
    splashScreen.setProgressVisible(true);
    splashScreen.setProgressMax(100);
    splashScreen.setProgressValue(null);

    systemServerSettings.action("update", "core", registry.core.downloadURL, () => {
      splashScreen.setStatus(i18n.t("startup:status.installingCoreSucceed"));
      splashScreen.setProgressVisible(false);
      callback();
    }, (progress) => {
      splashScreen.setProgressValue(progress);
    });
  });
}

function updateSystemsAndPlugins(registry: systemServerSettings.Registry, callback: Function) {
  // TODO

  // const label = i18n.t("startup:updateAvailable.core", { latest: registry.core.version, current: registry.core.localVersion });
  const label = "Update systems and plugins?";
  const options = {
    validationLabel: i18n.t("common:actions.update"),
    cancelLabel: i18n.t("common:actions.skip")
  };

  /* tslint:disable:no-unused-expression */
  new dialogs.ConfirmDialog(label, options, (shouldUpdate) => {
    /* tslint:enable:no-unused-expression */

    callback();
  });
}
