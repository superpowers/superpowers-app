"use strict";

const fs = require("fs");
const execSync = require("child_process").execSync;
const path = require("path");

const rootPackage = JSON.parse(fs.readFileSync(`${__dirname}/../package.json`, { encoding: "utf8" }));
const publicPackage = JSON.parse(fs.readFileSync(`${__dirname}/../public/package.json`, { encoding: "utf8" }));
publicPackage.version = rootPackage.version;
publicPackage.dependencies = rootPackage.dependencies;

fs.writeFileSync(`${__dirname}/../public/package.json`, JSON.stringify(publicPackage, null, 2) + "\n");

execSync("npm install --production", { cwd: `${__dirname}/../public`, stdio: "inherit" });
execSync("npm install rcedit@1.1.1 electron-packager@13.1.1", { stdio: "inherit" });

console.log("Running electron-packager...");

const packager = require("electron-packager");
const year = new Date().getFullYear();

packager({
  dir: "public",
  name: "Superpowers",
  platform: [ "linux", "win32","darwin" ],
  arch: [ "ia32", "x64" ],
  version: require(`${__dirname}/../node_modules/electron/package.json`).version,
  out: "packages",
  icon: "icons/superpowers",
  asar: false,
  "app-bundle-id": "com.sparklinlabs.superpowers",
  "app-version": publicPackage.version,
  "version-string": {
    "CompanyName": "Sparklin Labs",
    "LegalCopyright": `Copyright © 2014-${year} Sparklin Labs`,
    "FileVersion": publicPackage.version,
    "FileDescription": "The HTML5 2D+3D game maker",
    "ProductName": "Superpowers",
    "ProductVersion": publicPackage.version
  }
}).then((oldPaths) => {
  const buildPaths = [];
  for (const oldPath of oldPaths) {
    const newPath = oldPath
      .replace("Superpowers", `superpowers-v${publicPackage.version}`)
      .replace("-darwin-", "-osx-")
      .replace("-win32-", "-win-");
    fs.renameSync(oldPath, newPath);
    buildPaths.push(newPath);
  }

  for (let buildPath of buildPaths) {
    const folderName = path.basename(buildPath);
    console.log(`Generating archive for ${folderName}.`);
    try {
      execSync(`zip --symlinks -r ${folderName}.zip ${folderName}`, { cwd: `${__dirname}/../packages` });
    } catch (err) {
      console.error(err.stack);
    }
  }

  publicPackage.version = "0.0.0-dev";
  delete publicPackage.dependencies;
  fs.writeFileSync(`${__dirname}/../public/package.json`, JSON.stringify(publicPackage, null, 2) + "\n");
  execSync("npm prune", { cwd: `${__dirname}/../public`, stdio: "inherit" });

  console.log("Done.");
});
