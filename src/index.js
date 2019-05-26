const uploader = require('./uploader');
const utils = require('./utils');
const cloudfront = require('./cloudfront');
const localfs = require('./local-fs');
const utils = require('./utils');

module.exports = {
  ...uploader,
  ...utils,
  ...cloudfront,
  ...localfs,
};
