#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const { ensureEndsWith, transform } = require('./utils');
const { Uploader } = require('./uploader');

const argvToOptions = [
  ['concurrency', 'concurrency', value => parseInt(value, 10)],
  ['acl', 'acl'],
  ['key-prefix', 'keyPrefix', value => ensureEndsWith(value, '/')],
  ['check-md5', 'checkMD5', value => !!value],
  ['set-md5', 'setMD5', value => !!value],
  ['dry-run', 'dryRun', value => !!value],
  ['distribution', 'distributionId'],
  ['bucket', 'bucket'],
  ['granular-invalidation', 'granularInvalidation', value => !!value],
];

const envToOptions = [
  ['SSUP_AWS_ACCESS_KEY_ID', 'accessKeyId'],
  ['SSUP_AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'],
  ['SSUP_BUCKET', 'bucket'],
  ['SSUP_DISTRIBUTION_ID', 'distribution'],
  ['SSUP_KEY_PREFIX', 'keyPrefix'],
];

/**
 * Show an optional message, usage information and exit the program.
 *
 * @param {String} message Optional message to show before usage information.
 * @param {Number} exitCode The status code to exit the process with.
 */
function fail(message = null, exitCode = 1) {
  if (message) {
    if (exitCode === 0) {
      console.error(message, '\n');
    } else {
      console.error('Error:', message, '\n');
    }
  }

  if (exitCode !== null) {
    process.exit(exitCode);
  }
}

const defaultLogger = (...args) => {
  console.error(...args);
};

let logger = defaultLogger;

function log(...args) {
  if (logger) {
    logger(...args);
  }
}

(async () => {
  try {
    let options = {};
    let configPath = null;
    const argv = minimist(process.argv.slice(2));

    if (argv.quiet) {
      logger = null;
    }

    if (argv._.length > 0) {
      options.sourceDirectory = path.resolve(process.cwd(), argv._[0]);
      const rcPath = path.join(options.sourceDirectory, '.ssuprc.json');
      const rcExists = await fs.exists(rcPath);
      if (rcExists) {
        configPath = rcPath;
      }
    }

    // Explicitly specified config file overrides the rc file
    if (argv.config) {
      configPath = path.resolve(process.cwd(), argv.config);
    }

    if (configPath) {
      log(`Loading options from ${configPath}`);
      const fileConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
      options = { ...options, ...fileConfig };
    }

    // Derive options from environment variables and CLI arguments
    options = {
      ...options,
      ...transform(process.env, envToOptions),
      ...transform(argv, argvToOptions),
      sourceDirectory: path.resolve(process.cwd(), argv._[0]),
      logger: log,
    };

    const uploader = new Uploader(options);
    await uploader.run();
  } catch (err) {
    const message = err.message || err.code;
    fail(message);
  }
})();
