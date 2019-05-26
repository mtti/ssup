const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');
const minimist = require('minimist');
const pLimit = require('p-limit');
const { invalidateDistribution } = require('./cloudfront');
const { uploadFile } = require('./s3');
const { replaceExtension, scanDirectory } = require('./local-fs');

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
  console.error('Usage: s3-upload SOURCE_DIRECTORY --bucket=BUCKET [OPTIONS]');
  console.error('\n');
  console.error('Options (with default values):');
  console.error('    --acl=public-read\t\tACL to set on each uploaded object.');
  console.error('    --concurrency=5\t\tMax number of files to upload simultaneously.');
  console.error('    --key-prefix=\t\tS3 key prefix');
  console.error('    --no-check-md5\t\tDo use content-md5 metadata field to skip unchanged files.');
  console.error('    --no-set-md5\t\tDo not set content-md5 metadata field.');
  console.error('    --distribution\t\tCloudfront distribution ID to generate invalidations for.');
  console.error('    --granular-invalidation\tInvalidate individual files instead of everything.');

  console.error('\n');

  if (exitCode !== null) {
    process.exit(exitCode);
  }
}

(async () => {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    fail('@mtti/s3-upload v.0.1.0', 0);
  }

  if (argv._.length < 1) {
    fail('Missing source directory');
  }

  if (!argv.bucket) {
    fail('Missing --bucket option');
  }

  let concurrency = 5;
  if (argv.concurrency) {
    concurrency = parseInt(argv.concurrency);
  }

  const s3Options = {
    Bucket: argv.bucket,
    ACL: argv.acl || 'public-read',
  };

  let keyPrefix = '';
  if (argv['key-prefix']) {
    keyPrefix = argv['key-prefix'];
    if (keyPrefix.slice(-1) !== '/') {
      keyPrefix = `${keyPrefix}/`;
    }
  }

  const options = {
    checkMD5: true,
    setMD5: true,
  };
  if (argv['check-md5'] === false) {
    options.checkMD5 = false;
  }
  if (argv['set-md5'] === false) {
    options.setMD5 = false;
  }

  let distributionId = null;
  if (argv['distribution']) {
    distributionId = argv['distribution'];
  }
  const granularInvalidation = argv['granular-invalidation'] === true;

  const accessKeyId = '';
  const secretAccessKey = '';

  const limit = pLimit(concurrency);

  try {
    const sourcePath = path.resolve(process.cwd(), argv._[0]);

    console.error(`Source directory: ${sourcePath}`);

    const s3 = new AWS.S3({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const promises = (await scanDirectory(sourcePath))
      .map((file) => {
        const source = {
          path: file.path,
          uri: file.relativePath,
        };

        source.s3 = {
          Key: `${keyPrefix}${file.relativePath}`,
          ContentLength: file.stat.size,
        }
        const ext = path.extname(file.name);
        if (ext === '.html') {
          if (file.name !== 'index.html') {
            source.s3.Key = replaceExtension(source.s3.Key);
            source.uri = replaceExtension(source.uri);
          }
          source.s3.ContentType = 'text/html';
        }

        return source;
      })
      .map(source => limit(() => uploadFile(s3, source, { ...s3Options, ...source.s3 }, options)));

    const uploadedUris = (await Promise.all(promises))
      .filter(key => key);

    if (distributionId) {
      const cf = new AWS.CloudFront({
        accessKeyId,
        secretAccessKey,
      });
      if (granularInvalidation) {
        await invalidateDistribution(cf, distributionId, uploadedUris);
      } else {
        await invalidateDistribution(cf, distributionId);
      }
    }
  } catch (err) {
    console.error('Error:', err.message, '\n');
    console.error(err.stack, '\n');
    process.exit(1);
  }
})();
