"use strict";

const spawn = require("child_process").spawn;
const spawnOptions = { stdio: "inherit" };
const suffix = (process.platform === "win32") ? ".cmd" : "";

const watchMode = process.argv[2] === "-w";
const watchArgs = watchMode ? [ "-w" ] : []; 

// Node
spawn(`tsc${suffix}`, watchArgs.concat([ "-p", `${__dirname}/src/node` ]), spawnOptions);

// Renderer
spawn(`jade${suffix}`, watchArgs.concat([ `${__dirname}/src/renderer/index.jade`, "--out", `${__dirname}/app/renderer` ]), spawnOptions);
spawn(`stylus${suffix}`, watchArgs.concat([ `${__dirname}/src/renderer/index.styl`, "--out", `${__dirname}/app/renderer` ]), spawnOptions);
spawn(`tsc${suffix}`, watchArgs.concat([ "-p", `${__dirname}/src/renderer` ]), spawnOptions);
