const fs = require('fs');
const { hashFile } = require('./local-fs');

/**
 * Check if the content-md5 header of an object matches a value.
 *
 * @param {*} s3 Amazon S3 connection.
 * @param {string} bucket Name of the S3 bucket
 * @param {string} key Key of the object to check
 * @param {string} checksum Base64 MD5 hash to check for.
 * @returns {boolean} A value indicating whether the object exists and its content-md5 metadata
 *  field matches the `checksum` parameter.
 */
async function compareChecksum(s3, bucket, key, checksum) {
  const params = {
    Bucket: bucket,
    Key: key,
  };
  try {
    const head = await s3.headObject(params).promise();
    return head.Metadata['content-md5'] === checksum;
  } catch (err) {
    if (err.code === 'NotFound') {
      return false;
    }
    throw err;
  }
}

/**
 * Upload a file to Amazon S3, returning its S3 key if it was uploaded or `null` if it was skipped.
 * Re-uploads of existing, unchanged files will be skipped if the `checkMD5` option is `true` and
 * the `setMD5` option was true when the file was originally uploaded.
 *
 * @param {*} s3 Amazon S3 connection.
 * @param {*} source Full path to the file to upload.
 * @param {object} s3Params Parameters to pass to the putObject call.
 * @param {object} options Extra options.
 * @returns {string|null} The relative path of the file if it was uploaded, or `null` if it was
 *  skipped.
 */
async function uploadFile(s3, source, s3Params, { setMD5, checkMD5 }) {
  const checksum = await hashFile(source.path);

  const params = {
    ...s3Params,
    ContentMD5: checksum,
    Metadata: {},
  };
  if (checkMD5) {
    const changed = !(await compareChecksum(s3, params.Bucket, params.Key, checksum));
    if (!changed) {
      console.error('Not changed', source.path, '=>', params.Key);
      return null;
    }
  }
  if (setMD5) {
    params.Metadata['content-md5'] = checksum;
  }

  params.Body = fs.createReadStream(source.path);
  await s3.putObject(params).promise();

  console.error('Uploaded', source.path, '=>', params.Key);
  return source.uri;
}

module.exports = { uploadFile };
