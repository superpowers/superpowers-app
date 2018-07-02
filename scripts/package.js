"use strict";

const yargs = require("yargs");
const fs = require("fs");
const execSync = require("child_process").execSync;
const path = require("path");

const rootPackage = JSON.parse(fs.readFileSync(`${__dirname}/../package.json`, { encoding: "utf8" }));
const publicPackage = JSON.parse(fs.readFileSync(`${__dirname}/../public/package.json`, { encoding: "utf8" }));
publicPackage.version = rootPackage.version;
publicPackage.dependencies = rootPackage.dependencies;

const argv = yargs.argv;
let platform = argv._[0];
let arch = argv._[1];

if (arch == null) {
  arch = "all";
}
if (platform == null) {
  platform = "all";
}

fs.writeFileSync(`${__dirname}/../public/package.json`, JSON.stringify(publicPackage, null, 2) + "\n");

execSync("npm install --production", { cwd: `${__dirname}/../public`, stdio: "inherit" });

// Running rcedit@0.5.1 on Wine 1.4 tries to access the display server, making the build fail on Travis
// Wine 1.6 presumably works, but Travis currently doesn't allow installing it
// electron-packager@7.2.0 explicitely depends on rcedit@^0.5.1 so we can't use it.
// See https://github.com/electron-userland/electron-packager/issues/413
execSync("npm install rcedit@0.5.0 electron-packager@7.1.0", { stdio: "inherit" });

console.log(`Running electron-packager for platform '${platform}' and arch '${arch}'...`);

const packager = require("electron-packager");
const year = new Date().getFullYear();

packager({
  dir: "public",
  name: "Superpowers",
  platform: platform,
  arch: arch,
  version: publicPackage.superpowers.electron,
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
}, (err, oldPaths) => {
  if (err) throw err;

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
