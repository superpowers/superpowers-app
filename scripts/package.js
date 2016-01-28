"use strict";

const fs = require("fs");
const execSync = require("child_process").execSync;
const path = require("path");

const rootPackage = JSON.parse(fs.readFileSync(`${__dirname}/../package.json`, { encoding: "utf8" }));
const appPackage = JSON.parse(fs.readFileSync(`${__dirname}/../app/package.json`, { encoding: "utf8" }));
appPackage.dependencies = rootPackage.dependencies;

fs.writeFileSync(`${__dirname}/../app/package.json`, JSON.stringify(appPackage, null, 2));

execSync("npm install --production", { cwd: `${__dirname}/../app`, stdio: "inherit" });
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
    const newPath = oldPath
      .replace("Superpowers", "superpowers")
      .replace("-darwin-", "-osx-")
      .replace("-win32-", "-win-");
    fs.renameSync(oldPath, newPath);
    buildPaths.push(newPath);
  }

  for (let buildPath of buildPaths) {
    const folderName = path.basename(buildPath);
    console.log(`Generating archive for ${folderName}.`);
    execSync(`zip --symlinks -r ${folderName}.zip ${folderName}`, { cwd: `${__dirname}/../packages` });
  }

  console.log("Done.");
});
