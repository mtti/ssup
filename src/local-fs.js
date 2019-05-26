const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => {
      hash.update(data);
    });
    stream.on('end', () => {
      resolve(hash.digest('base64'));
    });
  });
}

/**
 * Replace the file extension of a path with another. Works simply by splitting by a period, which
 * will lead to unexpected behavior if the path does not have an extension.
 *
 * @param {String} originalPath Path to a file with an extension.
 * @param {String} newExtension An optional extension to replace the old one with.
 * @returns {String} The path with the extension replaced.
 */
function replaceExtension(originalPath, newExtension = null) {
  const parts = originalPath.split('.').slice(0, -1);
  if (newExtension) {
    parts.push(newExtension);
  }
  return parts.join('.');
}

/**
 * Recursively retrieve a list of all files in a directory and all of its subdirectories.
 *
 * @param {String} directory The directory to scan
 * @param {String} root Used internally with recursive calls
 * @return {Promise<Array>} A promise which resolves to an array with file objects.
 */
async function scanDirectory(directory, root) {
  if (!root) {
    root = directory;
  }

  const children = fs.readdirSync(directory)
    .map(name => ({ name, path: path.join(directory, name)}))
    .map(child => ({ ...child, relativePath: path.relative(root, child.path)}))
    .map(child => ({ ...child, stat: fs.statSync(child.path)}));

  const files = children
    .filter(child => child.stat.isFile());
  const subdirectories = children
    .filter(child => child.stat.isDirectory());

  for (let subdirectory of subdirectories) {
    const subdirFiles = await scanDirectory(subdirectory.path, root);
    files.push(...subdirFiles);
  }

  return files;
}

module.exports = { hashFile, replaceExtension, scanDirectory };
