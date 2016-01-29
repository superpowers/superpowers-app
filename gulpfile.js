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

  gulp.task(`jade-index-${languageCode}`, () => {
    const result = gulp.src("./src/renderer/index.jade").pipe(jade({ locals: { t: i18n.makeT(locale) } }));
    if (languageCode !== "en") result.pipe(rename({ extname: `.${languageCode}.html` }));
    return result.pipe(gulp.dest("app/renderer"));
  });

  tasks.push(`jade-index-${languageCode}`);
}

// Stylus
const stylus = require("gulp-stylus");

gulp.task("stylus-index", () => gulp.src("./src/renderer/index.styl").pipe(stylus({ compress: true })).pipe(gulp.dest("app/renderer")));
tasks.push("stylus-index");

// TypeScript
const ts = require("gulp-typescript");
const tslint = require("gulp-tslint");

// Node
const tsProject = ts.createProject("./src/tsconfig.json");

gulp.task("typescript", () => {
  let failed = false;
  const tsResult = tsProject.src()
    .pipe(tslint({ tslint: require("tslint") }))
    .pipe(tslint.report("prose", { emitError: false }))
    .pipe(ts(tsProject))
    .on("error", () => { failed = true; })
    .on("end", () => { if (failed) throw new Error("There were TypeScript errors."); });
  return tsResult.js.pipe(gulp.dest("./app"));
});
tasks.push("typescript");

// All
gulp.task("default", tasks);
