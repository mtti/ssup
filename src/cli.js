const fs = require('fs');
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
  ['BUCKET', 'bucket'],
  ['AWS_ACCESS_KEY_ID', 'accessKeyId'],
  ['AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'],
  ['DISTRIBUTION_ID', 'distribution'],
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

  console.error('\n');

  if (exitCode !== null) {
    process.exit(exitCode);
  }
}

(async () => {
  try {
    const options = {};
    const argv = minimist(process.argv.slice(2));
    if (argv._.length < 1) {
      fail('Missing source path');
    }

    // Load configuration file if specified
    if (argv.config) {
      const configPath = path.resolve(process.cwd(), argv.config);
      console.error(`Loading options from ${configPath}`);
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      Object.assign(options, fileConfig);
    }

    // Derive options from environment variables and CLI arguments
    transform(process.env, options, envToOptions);
    transform(argv, options, argvToOptions);
    options.sourceDirectory = path.resolve(process.cwd(), argv._[0]);

    const uploader = new Uploader(options);
    await uploader.run();
  } catch (err) {
    const message = err.message || err.code;
    fail(message);
  }
})();
