const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const pLimit = require('p-limit');
const { createInvalidation, hasOngoingInvalidations } = require('./cloudfront');
const { replaceExtension, scanDirectory, hashFile } = require('./local-fs');

const REQUIRED_OPTIONS = [
  'sourceDirectory',
  'bucket',
];

const DEFAULT_OPTIONS = {
  checkMD5: true,
  checkOngoingInvalidations: false,
  setMD5: true,
  granularInvalidation: false,
  acl: 'public-read',
  keyPrefix: '',
  concurrency: 5,
  dryRun: false,
};

class Uploader {
  constructor(options) {
    this._options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    for (const key of REQUIRED_OPTIONS) {
      if (!this._options[key]) {
        throw new Error(`Missing required option: ${key}`);
      }
    }

    let awsCredentials = null;
    if (this._options.accessKeyId) {
      if (!this._options.secretAccessKey) {
        throw new Error('secretAccessKey is required when accessKeyId is present');
      }
      awsCredentials = {
        accessKeyId: this._options.accessKeyId,
        secretAccessKey: this._options.secretAccessKey,
      };
    }

    this._limit = pLimit(this._options.concurrency);
    this._logger = this._options.logger;

    const s3Options = {};
    if (awsCredentials) {
      s3Options.credentials = { ...awsCredentials };
    }
    this._s3 = new AWS.S3(s3Options);

    if (this._options.distributionId) {
      const cloudFrontOptions = {};
      if (awsCredentials) {
        Object.assign(cloudFrontOptions, awsCredentials);
      }
      this._cloudfront = new AWS.CloudFront(cloudFrontOptions);
    }
  }

  _log(...messages) {
    if (this._logger) {
      this._logger(...messages);
    }
  }

  async _contentChecksumMatches(key, checksum) {
    const params = {
      Bucket: this._options.bucket,
      Key: key,
    };
    try {
      const headers = await this._s3.headObject(params).promise();
      return headers.Metadata['content-md5'] === checksum;
    } catch (err) {
      if (err.code === 'NotFound') {
        return false;
      }
      throw err;
    }
  }

  async _gatherFiles() {
    return Promise.all((await scanDirectory(this._options.sourceDirectory))
      .map((file) => {
        const ext = path.extname(file.name);
        let uri = file.relativePath;
        let s3ContentType = null;

        if (ext === '.html') {
          if (file.name !== 'index.html') {
            uri = replaceExtension(uri);
          }
          s3ContentType = 'text/html';
        }

        return {
          ...file,
          uri,
          s3ContentType,
          s3Key: `${this._options.keyPrefix}${uri}`,
        };
      })
      .map(file => this._limit(async () => {
        const checksum = await hashFile(file.path);
        return { ...file, checksum };
      })));
  }

  async _uploadFiles(files) {
    const commonS3Params = {
      Bucket: this._options.bucket,
      ACL: this._options.acl,
    };

    return (await Promise.all(files.map(file => this._limit(async () => {
      const s3Params = {
        ...commonS3Params,
        Key: file.s3Key,
        ContentMD5: file.checksum,
        Metadata: {},
      };

      if (file.s3ContentType) {
        s3Params.ContentType = file.s3ContentType;
      }
      if (this._options.checkMD5) {
        const changed = !(await this._contentChecksumMatches(
          file.s3Key,
          file.checksum,
        ));
        if (!changed) {
          this._log('Not changed', file.path, '=>', file.s3Key);
          return null;
        }
      }
      if (this._options.setMD5) {
        s3Params.Metadata['content-md5'] = file.checksum;
      }

      if (!this._options.dryRun) {
        s3Params.Body = fs.createReadStream(file.path);
        await this._s3.putObject(s3Params).promise();
      }

      this._log('Uploaded', file.path, '=>', file.s3Key);

      return file.uri;
    })))).filter(uri => uri);
  }

  async run() {
    if (this._options.checkOngoingInvalidations && this._options.distributionId) {
      this._log('Looking for ongoing CloudFront invalidations');
      const busy = await hasOngoingInvalidations(
        this._cloudfront,
        this._options.distributionId,
      );
      if (busy) {
        throw new Error('Distribution has ongoing invalidations');
      }
    }

    this._log('Gathering files');
    const files = await this._gatherFiles();

    this._log('Uploading files');
    const uploadedUris = await this._uploadFiles(files);

    if (this._options.distributionId) {
      this._log('Creating CloudFront invalidation');
      if (!this._options.dryRun) {
        if (this._options.granularInvalidation) {
          await createInvalidation(this._cloudfront, this._options.distributionId, uploadedUris);
        } else {
          await createInvalidation(this._cloudfront, this._options.distributionId, uploadedUris);
        }
      }
    }
  }
}

module.exports = { Uploader };
