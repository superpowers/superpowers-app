"use strict";

const yargs = require("yargs");

const fs = require("fs");
exports.localesPath = `${__dirname}/../app/renderer/locales`;

let fallbackLocale = null;

exports.loadLocale = (languageCode) => {
  if (languageCode === "none") return {};
  if (fallbackLocale == null && languageCode !== "en") fallbackLocale = exports.loadLocale("en");

  const namespaces = {};

  let filenames = [];
  try { filenames = fs.readdirSync(`${exports.localesPath}/${languageCode}`); } catch (err) { /* Ignore */ } 
  for (const filename of filenames) {
    const file = fs.readFileSync(`${exports.localesPath}/${languageCode}/${filename}`, { encoding: "utf8" });
    namespaces[filename.slice(0, filename.lastIndexOf("."))] = JSON.parse(file);
  }

  if (languageCode !== "en") reportMissingKeys(languageCode, namespaces);
  return namespaces;
};

exports.makeT = (locale) => {
  return function t(path) {
    const parts = path.split(":");
    let value = locale[parts[0]];
    if (value == null) return path;

    const keys = parts[1].split(".");
    for (const key of keys) {
      value = value[key];
      if (value == null) return path;
    }
    return value;
  }
};

function reportMissingKeys(languageCode, locale) {
  const missingKeys = [];

  function checkRecursively(fallbackRoot, root, key, path) {
    if (root[key] == null) {
      missingKeys.push(path);
      root[key] = fallbackRoot[key];
    } else if (typeof fallbackRoot[key] === "object") {
      const childKeys = Object.keys(fallbackRoot[key]);
      for (const childKey of childKeys) checkRecursively(fallbackRoot[key], root[key], childKey, `${path}.${childKey}`);
    }
  }

  const rootKeys = Object.keys(fallbackLocale);
  for (const rootKey of rootKeys) checkRecursively(fallbackLocale, locale, rootKey, rootKey);

  if (missingKeys.length > 0 && yargs.silent) {
    console.log(`Missing keys in ${languageCode} locale: ${missingKeys.join(", ")}`);
  }
}
