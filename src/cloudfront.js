
/**
 * Check if a CloudFront distribution has any ongoing invalidations.
 *
 * @param {*} cf
 * @param {*} distributionId
 */
async function hasOngoingInvalidations(cf, distributionId) {
  const params = {
    DistributionId: distributionId,
  };

  const result = await cf.listInvalidations(params).promise();

  const items = result.InvalidationList.Items;
  for (const item of items) {
    if (item.Status !== 'Completed') {
      return true;
    }
  }

  return false;
}

async function createInvalidation(cf, distributionId, keys = null) {
  let items = [];
  if (keys === null) {
    items = [ '/*' ];
  } else if (!Array.isArray(keys)) {
    throw new Error('keys must be an array or null');
  } else if (keys.length === 0) {
    return;
  } else {
    items = keys.map(key => `/${key}`);
  }

  const callerReference = getTimestampString();

  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: callerReference,
      Paths: {
        Quantity: items.length,
        Items: items,
      },
    }
  };

  try {
    await cf.createInvalidation(params).promise();
  } catch (err) {
    const message = err.message || err.code;
    throw new Error(`Cloudfront Error: ${message}`);
  }
}

module.exports = { createInvalidation, hasOngoingInvalidations };
