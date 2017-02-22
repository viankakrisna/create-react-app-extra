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

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
require('dotenv').config({ silent: true });

var chalk = require('chalk');
var fs = require('fs-extra');
var path = require('path');
var filesize = require('filesize');
var gzipSize = require('gzip-size').sync;
var webpack = require('webpack');
var config = require('../config/webpack.config.watch');
var paths = require('../config/paths');
var checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
var formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
var clearConsole = require('react-dev-utils/clearConsole');
var recursive = require('recursive-readdir');
var stripAnsi = require('strip-ansi');
var difference = require('lodash/difference');
var useYarn = fs.existsSync(paths.yarnLockFile);
var cli = useYarn ? 'yarn' : 'npm';
var isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Input: /User/dan/app/build/static/js/main.82be8.js
// Output: /static/js/main.js
function removeFileNameHash(fileName) {
  return fileName
    .replace(paths.appBuild, '')
    .replace(/\/?(.*)(\.\w+)(\.js|\.css)/, (match, p1, p2, p3) => p1 + p3);
}

// Input: 1024, 2048
// Output: "(+1 KB)"
function getDifferenceLabel(currentSize, previousSize) {
  var FIFTY_KILOBYTES = 1024 * 50;
  var difference = currentSize - previousSize;
  var fileSize = !Number.isNaN(difference) ? filesize(difference) : 0;
  if (difference >= FIFTY_KILOBYTES) {
    return chalk.red('+' + fileSize);
  } else if (difference < FIFTY_KILOBYTES && difference > 0) {
    return chalk.yellow('+' + fileSize);
  } else if (difference < 0) {
    return chalk.green(fileSize);
  } else {
    return '';
  }
}
var previousSizeMap;
// First, read the current file sizes in build directory.
// This lets us display how much they changed later.
recursive(paths.appBuild, (err, fileNames) => {
  previousSizeMap = (fileNames || [])
    .filter(fileName => /\.(js|css)$/.test(fileName))
    .reduce(
      (memo, fileName) => {
        var contents = fs.readFileSync(fileName);
        var key = removeFileNameHash(fileName);
        memo[key] = gzipSize(contents);
        return memo;
      },
      {}
    );
  // Start the webpack build
  watch(previousSizeMap);
  // Merge with the public folder
});

// Print a detailed summary of build files.
function printFileSizes(stats, previousSizeMap) {
  var assets = stats
    .toJson()
    .assets.filter(asset => /\.(js|css)$/.test(asset.name))
    .map(asset => {
      var fileContents = fs.readFileSync(paths.appBuild + '/' + asset.name);
      var size = gzipSize(fileContents);
      var previousSize = previousSizeMap[removeFileNameHash(asset.name)];
      var difference = getDifferenceLabel(size, previousSize);
      return {
        folder: path.join('build', path.dirname(asset.name)),
        name: path.basename(asset.name),
        size: size,
        sizeLabel: filesize(size) + (difference ? ' (' + difference + ')' : '')
      };
    });
  assets.sort((a, b) => b.size - a.size);
  var longestSizeLabelLength = Math.max.apply(
    null,
    assets.map(a => stripAnsi(a.sizeLabel).length)
  );
  assets.forEach(asset => {
    var sizeLabel = asset.sizeLabel;
    var sizeLength = stripAnsi(sizeLabel).length;
    if (sizeLength < longestSizeLabelLength) {
      var rightPadding = ' '.repeat(longestSizeLabelLength - sizeLength);
      sizeLabel += rightPadding;
    }
    console.log(
      '  ' +
        sizeLabel +
        '  ' +
        chalk.dim(asset.folder + path.sep) +
        chalk.cyan(asset.name)
    );
  });
}

function watch(previousSizeMap) {
  clearConsole();

  console.log('Compiling ' + process.env.NODE_ENV + ' build...');

  var isFirstCompile = true;
  var watcher = webpack(config, (err, stats) => {});

  var compiler = watcher.compiler;

  compiler.plugin('done', function(stats) {
    if (isInteractive) {
      clearConsole();
    }
    recursive(paths.appBuild, (err, fileNames) => {
      difference(
        fileNames,
        stats
          .toJson()
          .assets.map(asset => path.join(paths.appBuild, asset.name))
      ).map(file => fs.unlinkSync(file));
      copyPublicFolder();

      var messages = formatWebpackMessages(stats.toJson({}, true));
      var isSuccessful = !messages.errors.length && !messages.warnings.length;

      if (isSuccessful) {
        console.log(
          chalk.green('Successfully compiled a', process.env.NODE_ENV, 'build.')
        );
        console.log(
          [
            '',
            'You can access the compiled files in',
            paths.appBuild,
            '',
            'File sizes after gzip:',
            ''
          ].join('\n')
        );
        printFileSizes(stats, previousSizeMap);
        if (isFirstCompile) {
          console.log(
            [
              '',
              'Note that running in watch mode is slower and only recommended if you need to',
              'serve the assets with your own back-end in development.',
              ''
            ].join('\n')
          );
          console.log(
            'To create a development server, use ' +
              chalk.cyan(cli + ' start') +
              '.'
          );
          isFirstCompile = false;
        }
      }

      // If errors exist, only show errors.
      if (messages.errors.length) {
        console.log(chalk.red('Failed to compile.'));
        console.log();
        messages.errors.forEach(message => {
          console.log(message);
          console.log();
        });
        return;
      }

      // Show warnings if no errors were found.
      if (messages.warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.'));
        console.log();
        messages.warnings.forEach(message => {
          console.log(message);
          console.log();
        });
        // Teach some ESLint tricks.
        console.log('You may use special comments to disable some warnings.');
        console.log(
          'Use ' +
            chalk.yellow('// eslint-disable-next-line') +
            ' to ignore the next line.'
        );
        console.log(
          'Use ' +
            chalk.yellow('/* eslint-disable */') +
            ' to ignore all warnings in a file.'
        );
      }
      console.log();
      console.log(
        'Waiting for changes in',
        paths.appSrc.replace(process.cwd(), '.') + '/'
      );
    });
  });

  compiler.plugin('invalid', function() {
    if (isInteractive) {
      clearConsole();
    }
    copyPublicFolder();
    console.log('Compiling...');
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: file => file !== paths.appHtml
  });
}
