/*jshint node:true */

'use strict';

var gutil = require('gulp-util');
var c = gutil.colors;
var es = require('event-stream');
var extend = require('xtend');
var path = require('path');
var spawn = require('child_process').spawn;
var File = gutil.File;

var server = require('karma').server;

var karmaPlugin = function(options) {
  var child;
  var stream;
  var files = [];
  var buffer = [];

  options = extend({
    action: 'run'
  }, options);

  var action = options.action;

  // Remove option in case Karma uses it in the future
  delete options.action;

  if (action === 'watch') {
    // Never set singleRun in background mode
    options.singleRun = false;

    // Enable watching
    options.autoWatch = true;
  }
  else if (action === 'run') {
    // Tell Karma to run once and exit
    options.singleRun = true;

    // Disable watching
    options.autoWatch = false;
  }

  if (options.configFile) {
    options.configFile = path.resolve(options.configFile);
  }

  function done(code) {
    // Stop the server if it's running
    if (child) {
      child.kill();
    }

    // End the stream if it exists
    if (stream) {
      stream.emit('end');
    }
  }

  function startKarmaServer() {
    gutil.log('Starting Karma server...');

    // Start the server
    child = spawn(
      'node',
      [
        path.join(__dirname, 'lib', 'background.js'),
        JSON.stringify(options)
      ],
      {
        stdio: [process.stdin,null,process.stderr]
      }
    );

    // Cleanup when the child process exits
    child.on('exit', function() {
      // gutil.log('Karma child process ended');
      done();
    });

    child.stdout.on('data', function (data) {
      var result = (c.stripColor(data.toString())).match(/TOTAL: \d+ SUCCESS/)
      var intermediateResult = (c.stripColor(data.toString())).match(/(\d+) of (\d+) SUCCESS/)
      process.stdout.write(data)
      if(result){
        stream.emit('data', buffer[0])
      }
      // if(intermediateResult && intermediateResult[1] == intermediateResult[2]){
      //   stream.emit('data', buffer[0])
      // }
    });
  }

  function queueFile(file) {
    if (file) {
      buffer.push(file)
    }
    else {
      stream.emit('error', new Error('Got undefined file'));
    }
  }

  function endStream() {
    // Override files if they were piped
    // This doesn't work with the runner, but works fine with singleRun and autoWatch
    // if (files.length && overrideFiles) {
    //   options.files = files;
    // }

    // Start the server
    // If options.singleRun: Server starts, tests run, task completes
    // If options.background: Server starts, tests run, files watched
    startKarmaServer();
  }

  stream = es.through(queueFile, endStream);

  return stream;
};

module.exports = karmaPlugin;
