import * as async from "async";
import * as fs from "fs";

interface I18nValue { [key: string]: I18nValue | string; }
interface I18nContext { [name: string]: I18nValue; }

export const languageIds = fs.readdirSync(`${__dirname}/../locales`);
export let languageCode: string;
export const contexts: { [name: string]: I18nContext } = {};
export const fallbackContexts: { [name: string]: I18nContext } = {};

export class LocalizedError {
  constructor(public key: string, public variables: { [key: string]: string; }) {}
}

export function load(contextNames: string[], callback: () => void) {
  async.each(contextNames, loadContext.bind(null, languageCode, contexts), () => {
    if (languageCode === "en") { callback(); return; }

    async.each(contextNames, loadContext.bind(null, "en", fallbackContexts), callback);
  });
}

export function t(key: string, variables?: { [name: string]: string|number; }) {
  let result = genericT(contexts, key, variables);
  if (result == null) result = genericT(fallbackContexts, key, variables);
  return result != null ? result : key;
}

export function getLocalizedFilename(filename: string) {
  if (languageCode === "en") return filename;
  const [ basename, extension ] = filename.split(".");
  return `${basename}.${languageCode}.${extension}`;
}

function loadContext(languageCode: string, contexts: { [name: string]: I18nContext; }, contextName: string, callback: () => void) {
  const filePath = `${__dirname}/../locales/${languageCode}/${contextName}.json`;

  fs.readFile(filePath, { encoding: "utf8" }, (err, text) => {
    if (err != null) { callback(); return; }
    contexts[contextName] = JSON.parse(text);
    callback();
  });
}

function genericT(contexts: { [name: string]: I18nContext; }, key: string, variables?: { [name: string]: string|number; }) {
  const [ contextName, keys ] = key.split(":");
  const keyParts = keys.split(".");

  let valueOrText: I18nValue|string = contexts[contextName];
  if (valueOrText == null) return null;

  for (const keyPart of keyParts) {
    valueOrText = (valueOrText as I18nValue)[keyPart];
    if (valueOrText == null) return null;
  }

  if (typeof valueOrText === "string") return insertVariables(valueOrText, variables);
  else return key;
}

function insertVariables(text: string, variables: { [key: string]: string|number; }) {
  let index = 0;
  do {
    index = text.indexOf("${", index);
    if (index !== -1) {
      const endIndex = text.indexOf("}", index);
      const key = text.slice(index + 2, endIndex);
      const value = variables[key] != null ? variables[key] : `"${key}" is missing`;
      text = text.slice(0, index) + value + text.slice(endIndex + 1);
      index += 1;
    }
  } while (index !== -1);

  return text;
}
