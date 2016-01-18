"use strict";

const fs = require("fs");
const execSync = require("child_process").execSync;
const archiver = require("archiver");
const async = require("async");
const path = require("path");

const rootPackage = JSON.parse(fs.readFileSync(`${__dirname}/package.json`));
const appPackage = JSON.parse(fs.readFileSync(`${__dirname}/app/package.json`));
appPackage.dependencies = rootPackage.dependencies;

fs.writeFileSync(`${__dirname}/app/package.json`, JSON.stringify(appPackage, null, 2));

execSync("npm install --production", { cwd: `${__dirname}/app`, stdio: "inherit" });
execSync("npm install electron-packager", { stdio: "inherit" });

console.log("Running electron-packager...");

const packager = require("electron-packager");
const year = new Date().getFullYear();

packager({
  dir: "app",
  name: "Superpowers",
  all: true,
  version: appPackage.superpowers.electron,
  out: "packages",
  icon: "icons/superpowers",
  asar: false,
  "app-bundle-id": "com.sparklinlabs.superpowers",
  "app-version": appPackage.version,
  "version-string": {
    "CompanyName": "Sparklin Labs",
    "LegalCopyright": `Copyright © 2014-${year} Sparklin Labs`,
    "FileVersion": appPackage.version,
    "FileDescription": "The HTML5 2D+3D game maker",
    "ProductName": "Superpowers",
    "ProductVersion": appPackage.version
  }
}, (err, oldPaths) => {
  if (err) throw err;
  
  const buildPaths = [];
  for (const oldPath of oldPaths) {
    const newPath = oldPath.replace("Superpowers", "superpowers").replace("-darwin-", "-osx-");
    fs.renameSync(oldPath, newPath);
    buildPaths.push(newPath);
  }

  async.each(buildPaths, (buildPath, callback) => {
    const folderName = path.basename(buildPath);
    const output = fs.createWriteStream(`${buildPath}.zip`);
    const archive = archiver("zip");

    output.on("close", () => { callback(); });
    output.on("error", (err) => { throw err; });
    archive.pipe(output);

    let setEntryData = null;
    if (buildPath.indexOf("-osx-") !== -1 || buildPath.indexOf("-linux-") !== -1) {
      setEntryData = (data) => {
        if (data.name.indexOf("/Contents/MacOS/") !== -1 || data.name === `${folderName}/Superpowers`) {
          console.log(`Marked ${data.name} as executable.`);
          data.mode = 0o744;
        }
        return data;
      }
    }
    
    archive.directory(buildPath, folderName, setEntryData);
    archive.finalize();
  }, () => {
    console.log("Done.");
  });
});
