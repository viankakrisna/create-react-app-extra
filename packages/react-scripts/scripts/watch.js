// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
// @remove-on-eject-end
process.env.NODE_ENV = "development";

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
require("dotenv").config({ silent: true });

var chalk = require("chalk");
var fs = require("fs-extra");
var path = require("path");
var gzipSize = require("gzip-size").sync;
var webpack = require("webpack");
var readFilesInFolder = require("recursive-readdir");
var difference = require("lodash/difference");

var config = require("../config/webpack.config.watch");
var paths = require("../config/paths");

var clearConsole = require("react-dev-utils/clearConsole");
var checkRequiredFiles = require("react-dev-utils/checkRequiredFiles");
var formatWebpackMessages = require("react-dev-utils/formatWebpackMessages");

var printFileSizes = require("../utils/printFileSizes");
var copyPublicFolder = require("../utils/copyPublicFolder");
var removeFileNameHash = require("../utils/removeFileNameHash");
var bundleVendorIfStale = require("../utils/bundleVendorIfStale");

var useYarn = fs.existsSync(paths.yarnLockFile);
var cli = useYarn ? "yarn" : "npm";
var isInteractive = process.stdout.isTTY;
var echo = console.log; //alias console.log for easier printing

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// First, read the current file sizes in build directory.
// This lets us display how much they changed later.
bundleVendorIfStale(() => {
  readFilesInFolder(paths.appBuild, startWatchWithPreviousSizeMap);
});

function startWatchWithPreviousSizeMap(err, fileNames) {
  // Start the webpack watch mode
  watch(getPreviousSizeMap());
}

function watch(previousSizeMap) {
  clearConsoleIfInteractive();
  var isFirstCompile = true;
  var watcher = webpack(config, (err, stats) => {});
  var compiler = watcher.compiler;

  echo("Compiling " + process.env.NODE_ENV + " build...");
  compiler.plugin(
    "done",
    createCompilerDoneHandler(previousSizeMap, isFirstCompile)
  );
  compiler.plugin("invalid", handleCompilerInvalid);
}

function handleCompilerInvalid() {
  clearConsoleIfInteractive();

  echo("Compiling...");
}

function createCompilerDoneHandler(previousSizeMap, isFirstCompile) {
  return stats => {
    clearConsoleIfInteractive();
    readFilesInFolder(
      paths.appBuild,
      cleanUpAndPrintMessages(stats, previousSizeMap, isFirstCompile)
    );
  };
}

function cleanUpAndPrintMessages(stats, previousSizeMap, isFirstCompile) {
  return (err, fileNames) => {
    deleteStaleAssets(fileNames, stats); // Delete stale files
    copyPublicFolder(); // Update public folder

    var messages = formatWebpackMessages(stats.toJson({}, true));
    var isSuccessful = !messages.errors.length && !messages.warnings.length;

    if (isSuccessful) {
      printWatchSuccessMessage(
        messages,
        stats,
        previousSizeMap,
        isFirstCompile
      );
      return printWaitingChanges();
    }

    // If errors exist, only print errors.
    if (messages.errors.length) {
      printErrors(messages);
      return printWaitingChanges();
    }

    // Print warnings if no errors were found.
    if (messages.warnings.length) {
      printWarnings(messages);
      return printWaitingChanges();
    }
  };
}

function printErrors(messages) {
  echo(chalk.red("Failed to compile."));
  echo();
  messages.errors.forEach(message => {
    echo(message);
    echo();
  });
}

function printWatchSuccessMessage(
  messages,
  stats,
  previousSizeMap,
  isFirstCompile
) {
  echo(
    [
      chalk.green(
        "Successfully compiled a " + process.env.NODE_ENV + " build."
      ),
      "",
      "You can access the compiled files in",
      paths.appBuild,
      "",
      "File sizes after gzip:",
      ""
    ].join("\n")
  );
  printFileSizes(stats, previousSizeMap);
  if (isFirstCompile) {
    echo(
      chalk.yellow(
        [
          "",
          "Note that running in watch mode is slower and only recommended if you need to",
          "serve the assets with your own back-end in development.",
          ""
        ].join("\n")
      )
    );
    echo(
      "To create a development server, use " + chalk.cyan(cli + " start") + "."
    );
    isFirstCompile = false;
  }
}

function printWarnings(messages) {
  echo(chalk.yellow("Compiled with warnings."));
  echo();
  messages.warnings.forEach(message => {
    echo(message);
    echo();
  });
  // Teach some ESLint tricks.
  echo("You may use special comments to disable some warnings.");
  echo(
    "Use " +
      chalk.yellow("// eslint-disable-next-line") +
      " to ignore the next line."
  );
  echo(
    "Use " +
      chalk.yellow("/* eslint-disable */") +
      " to ignore all warnings in a file."
  );
}

function clearConsoleIfInteractive() {
  if (isInteractive) {
    clearConsole();
  }
}

function previousSizeMapReducer(memo, fileName) {
  var contents = fs.readFileSync(fileName);
  var key = removeFileNameHash(fileName);
  memo[key] = gzipSize(contents);
  return memo;
}

function printWaitingChanges() {
  echo();
  echo(
    "Waiting for changes in",
    paths.appSrc.replace(process.cwd(), ".") + "/"
  );
}

function deleteStaleAssets(fileNames, stats) {
  var assets = stats.toJson().assets;
  var assetFileNames = assets
    .map(asset => path.join(paths.appBuild, asset.name))
    .filter(Boolean);
  var differences = difference(
    assetFileNames,
    fileNames
  ).map(file => fs.unlinkSync(file));
  return differences;
}

function getPreviousSizeMap(fileNames) {
  return (fileNames || [])
    .filter(fileName => /\.(js|css)$/.test(fileName))
    .reduce(previousSizeMapReducer, {});
}
