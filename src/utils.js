/**
 * Adds a suffix to a string if it does not already have it.
 *
 * @param {string} value
 * @param {string} suffix
 * @returns {string}
 */
function ensureEndsWith(value, suffix) {
  if (value.slice(suffix.length * -1) !== suffix) {
    return `${value}${suffix}`;
  }
  return value;
}

function transform(source, mapping) {
  const result = {};

  for (const [sourceKey, targetKey, transformer] of mapping) {
    if (!(sourceKey in source)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const sourceValue = source[sourceKey];
    let transformedValue = sourceValue;
    if (transformer) {
      transformedValue = transformer(sourceValue);
    }

    result[targetKey] = transformedValue;
  }

  return result;
}

/**
 * Pad the start of a value with enough characters to match a certain length.
 *
 * @param {string} value Original value
 * @param {string} c Character to add
 * @param {number} length Target length of the result
 */
function pad(value, c = '0', length = 2) {
  const original = value.toString();

  const difference = length - original.length;
  if (difference < 1) {
    return original;
  }

  return `${c.repeat(difference)}${original}`;
}

function getTimestampString() {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hours = pad(now.getUTCHours());
  const minutes = pad(now.getUTCMinutes());
  const seconds = pad(now.getUTCSeconds());

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

module.exports = {
  ensureEndsWith, getTimestampString, pad, transform,
};
