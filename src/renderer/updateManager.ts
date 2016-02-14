import * as electron from "electron";
import * as async from "async";
import * as path from "path";
import * as fs from "fs";
import * as dialogs from "simple-dialogs";
import * as mkdirp from "mkdirp";
import * as dummy_https from "https";
import * as settings from "./settings";
import * as i18n from "../shared/i18n";
import * as splashScreen from "./splashScreen";
import fetch from "../shared/fetch";

/* tslint:disable */
const https: typeof dummy_https = require("follow-redirects").https;
const yauzl = require("yauzl");
/* tslint:enable */

export let appVersion = electron.remote.app.getVersion();
if (appVersion === "0.0.0-dev") appVersion = `v${require(`${__dirname}/../../package.json`).version}-dev`;
else appVersion = `v${appVersion}`;

interface ComponentInfo {
  repository: string;
  current: string;
  latest: string;
  downloadURL?: string;
}

const components: { [name: string]: ComponentInfo } = {
  "app": { repository: "superpowers/superpowers-app", current: appVersion, latest: null },
  "core": { repository: "superpowers/superpowers-core", current: null, latest: null },
  "game": { repository: "superpowers/superpowers-game", current: null, latest: null }
};

function fetchVersions(callback: (err: Error) => void) {
  // TODO: Check the various installed systems too

  fs.readFile(`${settings.userDataPath}/core/package.json`, { encoding: "utf8" }, (err, corePackageJSON) => {
    if (err != null && err.code !== "ENOENT") throw err;

    if (corePackageJSON != null) {
      const corePackage = JSON.parse(corePackageJSON);
      components["core"].current = `v${corePackage.version}`;
    }

    async.each(Object.keys(components), (name, cb) => {
      fetch(`https://api.github.com/repos/${components[name].repository}/releases/latest`, "json", (err, lastRelease) => {
        if (err != null) { cb(err); return; }
        components[name].latest = lastRelease.tag_name as string;
        components[name].downloadURL = lastRelease.assets[0].browser_download_url as string;
        cb();
      });
    }, callback);
  });
}

function downloadRelease(downloadURL: string, downloadPath: string, callback: (err: string) => void) {
  splashScreen.setProgressVisible(true);
  splashScreen.setProgressValue(null);

  https.get({
    hostname: "github.com",
    path: downloadURL,
    headers: { "user-agent": "Superpowers" }
  }, (res) => {
    if (res.statusCode !== 200) {
      callback(`Unexpected status code: ${res.statusCode}`);
      return;
    }

    const size = parseInt(res.headers["content-length"], 10);
    splashScreen.setProgressMax(size);
    splashScreen.setProgressValue(0);
    let downloaded = 0;

    const buffers: Buffer[] = [];
    res.on("data", (data: Buffer) => { buffers.push(data); downloaded += data.length; splashScreen.setProgressValue(downloaded); });
    res.on("end", () => {
      const zipBuffer = Buffer.concat(buffers);

      yauzl.fromBuffer(zipBuffer/*, { lazyEntries: true }*/, (err: Error, zipFile: any) => {
        if (err != null) throw err;

        splashScreen.setProgressMax(zipFile.entryCount);
        splashScreen.setProgressValue(0);
        let entriesProcessed = 0;

        const rootFolderName = path.parse(downloadURL).name;

        //zipFile.readEntry();
        zipFile.on("entry", (entry: any) => {
          if (entry.fileName.indexOf(rootFolderName) !== 0) throw new Error(`Found file outside of root folder: ${entry.fileName} (${rootFolderName})`);

          const filename = path.join(downloadPath, entry.fileName.replace(rootFolderName, ""));
          if (/\/$/.test(entry.fileName)) {
            mkdirp(filename, (err) => {
              if (err != null) throw err;
              entriesProcessed++;
              splashScreen.setProgressValue(entriesProcessed);
              //zipFile.readEntry();
              if (entriesProcessed === zipFile.entryCount) done();
            });
          } else {
            zipFile.openReadStream(entry, (err: Error, readStream: NodeJS.ReadableStream) => {
              if (err) throw err;

              mkdirp(path.dirname(filename), (err: Error) => {
                if (err) throw err;
                readStream.pipe(fs.createWriteStream(filename));
                readStream.on("end", function() {
                  entriesProcessed++;
                  splashScreen.setProgressValue(entriesProcessed);
                  //zipFile.readEntry();
                  if (entriesProcessed === zipFile.entryCount) done();
                });
              });
            });
          }
        });

        /*zipFile.on("end", () => {
          callback(null);
        });*/
      });
    });

    /*let rootFolderName: string;
    res.pipe(unzip.Parse())
      .on("entry", (entry: ZipEntry) => {
        if (rootFolderName == null) {
          rootFolderName = entry.path;
          return;
        }

        const entryPath = `${downloadPath}/${entry.path.replace(rootFolderName, "")}`;
        if (entry.type === "Directory") mkdirp.sync(entryPath);
        else {
          console.log(`Start ${entry.path}`);
          const res = entry.pipe(fs.createWriteStream(entryPath));
          entries++;
          splashScreen.setProgressMax(entries);

          res.on("close", () => {
            completedEntries++;
            splashScreen.setProgressValue(completedEntries);
          });
        }
      })
      .on("close", () => {
        console.log("done!");
        console.log(completedEntries, entries);
        callback(null);
      });*/
  });

  function done() {
    splashScreen.setProgressVisible(false);
    callback(null);
  }
}

export function checkForUpdates(callback: Function) {
  // TODO: Offer installing a system on first run!
  async.series([ fetchVersions, checkAppUpdate, checkUpdates ],
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

function checkUpdates(callback: Function) {
  const core = components["core"];
  if (core.latest == null) return;

  // First installation
  if (core.current == null) {
    installCore((err) => {
      if (err != null) return;

      const label = i18n.t("startup:updateAvailable.askGameInstall");
      const options = {
        validationLabel: i18n.t("common:actions.install"),
        cancelLabel: i18n.t("common:actions.skip")
      };
      new dialogs.ConfirmDialog(label, options, (installGame) => {
        if (installGame) {
          splashScreen.setStatus(i18n.t("startup:status.installingGame"));
          // FIXME: Use common stuff from the core folder
          downloadRelease(components["game"].downloadURL, `${settings.userDataPath}/systems/game`, (error) => {
            if (error != null) {
              new dialogs.InfoDialog(i18n.t("startup:status.installingGameFailed", { error }), null, () => {
                callback(error);
              });
            } else {
              callback(null);
            }
          });
          return;
        }
        callback();
      });
    });
    return;
  }

  if (core.latest === core.current) { callback(null); return; }

  const label = i18n.t("startup:updateAvailable.core", { latest: core.latest, current: core.current });
  const options = {
    validationLabel: i18n.t("common:actions.update"),
    cancelLabel: i18n.t("common:actions.skip")
  };

  new dialogs.ConfirmDialog(label, options, (shouldUpdate) => {
    if (shouldUpdate) {
      // FIXME: Use common stuff from the core folder
      installCore(() => { callback(); });
      return;
    }
    callback();
  });

  return;
}

function installCore(callback: (error: string) => void) {
  splashScreen.setStatus(i18n.t("startup:status.installingCore"));

  downloadRelease(components["core"].downloadURL, `${settings.userDataPath}/core`, (error) => {
    if (error != null) {
      new dialogs.InfoDialog(i18n.t("startup:status.installingCoreFailed", { error }), null, () => {
        callback(error);
      });
    } else {
      splashScreen.setStatus(i18n.t("startup:status.installingCoreSucceed"));
      callback(null);
    }
  });
}
