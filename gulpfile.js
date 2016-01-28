"use strict";

const gulp = require("gulp");
const tasks = [];

// Jade
const jade = require("gulp-jade");
const rename = require("gulp-rename");
const fs = require("fs");

const i18n = require("./scripts/i18n.js");
const languageCodes = fs.readdirSync(i18n.localesPath);
languageCodes.push("none");

for (const languageCode of languageCodes) {
  const locale = i18n.loadLocale(languageCode);
  gulp.task(`jade-${languageCode}`, () => {
    const result = gulp.src("./src/renderer/index.jade").pipe(jade({ locals: { t: i18n.makeT(locale) } }));
    if (languageCode !== "en") result.pipe(rename({ extname: `.${languageCode}.html` }));
    return result.pipe(gulp.dest("app/renderer"));
  });
  tasks.push(`jade-${languageCode}`);
}

// Stylus
const stylus = require("gulp-stylus");

gulp.task("stylus-index", () => gulp.src("./src/renderer/index.styl").pipe(stylus({ compress: true })).pipe(gulp.dest("app/renderer")));
gulp.task("stylus-resize-handle", () => gulp.src("./src/renderer/resizeHandle.styl").pipe(stylus({ compress: true })).pipe(gulp.dest("app/renderer")));
tasks.push("stylus-index", "stylus-resize-handle");

// TypeScript
const ts = require("gulp-typescript");
const tslint = require("gulp-tslint");

// Node
const tsNodeProject = ts.createProject("./src/node/tsconfig.json");

gulp.task("typescript-node", () => {
  let failed = false;
  const tsResult = tsNodeProject.src()
    .pipe(tslint({ tslint: require("tslint") }))
    .pipe(tslint.report("prose", { emitError: false }))
    .pipe(ts(tsNodeProject))
    .on("error", () => { failed = true; })
    .on("end", () => { if (failed) throw new Error("There were TypeScript errors."); });
  return tsResult.js.pipe(gulp.dest("./app"));
});
tasks.push("typescript-node");

// Renderer
const tsRendererProject = ts.createProject("./src/renderer/tsconfig.json");

gulp.task("typescript-renderer", () => {
  let failed = false;
  const tsResult = tsRendererProject.src()
    .pipe(tslint({ tslint: require("tslint") }))
    .pipe(tslint.report("prose", { emitError: false }))
    .pipe(ts(tsRendererProject))
    .on("error", () => { failed = true; })
    .on("end", () => { if (failed) throw new Error("There were TypeScript errors."); });
  return tsResult.js.pipe(gulp.dest("./app/renderer"));
});
tasks.push("typescript-renderer");

// All
gulp.task("default", tasks);
