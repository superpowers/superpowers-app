"use strict";

const gulp = require("gulp");

// Pug
const pugTasks = [];

const pug = require("gulp-pug");
const rename = require("gulp-rename");
const fs = require("fs");

const i18n = require("./scripts/i18n.js");
const languageCodes = fs.readdirSync(i18n.localesPath);
languageCodes.push("none");

for (const languageCode of languageCodes) {
  const locale = i18n.loadLocale(languageCode);
  gulp.task(`pug-${languageCode}`, () => {
    let result = gulp.src("./src/renderer/index.pug").pipe(pug({ locals: { t: i18n.makeT(locale) } }));
    if (languageCode !== "en") result = result.pipe(rename({ extname: `.${languageCode}.html` }));
    return result.pipe(gulp.dest("public/renderer"));
  });
  pugTasks.push(`pug-${languageCode}`);
}

// Stylus
const stylus = require("gulp-stylus");
gulp.task("stylus", () => gulp.src("./src/renderer/index.styl").pipe(stylus({ compress: true })).pipe(gulp.dest("public/renderer")));

// TypeScript
const ts = require("gulp-typescript");
const tsProject = ts.createProject("./src/tsconfig.json");
const tslint = require("gulp-tslint");

gulp.task("typescript", () => {
  let failed = false;
  const tsResult = tsProject.src()
    .pipe(tslint({ formatter: "prose" }))
    .pipe(tslint.report({ emitError: true }))
    .on("error", (err) => { throw err; })
    .pipe(tsProject())
    .on("error", () => { failed = true; })
    .on("end", () => { if (failed) throw new Error("There were TypeScript errors."); });
  return tsResult.js.pipe(gulp.dest("./public"));
});

// All
gulp.task("default", gulp.parallel(gulp.parallel(pugTasks), "stylus", "typescript"));
