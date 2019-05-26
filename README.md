A command line utility for uploading static websites to Amazon S3.

## Features

* **Clean URLs** Uploads HTML files without their extension and `Content-Type` set to `text/html`. To preserve normal directory index behavior, any file called `index.html` will keep its extension, but the content type is still set.
* **Upload only changed files** The MD5 hash of each file is saved in S3 metadata as `content-md5` which is checked before reupload to only update and invalidate changed files.
* **CloudFront invalidation** Invalidations can be generated for a CloudFront distribution either to invalidate the entire distribution with `/*` (the default) or to only invalidate changed files.

## Configuration

Many configuration options are available and can be provided on the command line, as environment variables and from a configuration file with the `--config` CLI flag.

Option | CLI | Env | Description
-- | --- | --- | ---
`sourceDirectory` | The first unnamed argument | &nbsp; | **(Required)** The base directory to upload from.
`accessKeyId` | &nbsp; | `AWS_ACCESS_KEY_ID` | **(Required)** AWS access key ID
`secretAccessKey` | &nbsp; | `AWS_SECRET_ACCESS_KEY` | **(Required)** AWS access secret
`bucket` | `--bucket` | `BUCKET` | **(Required)** Amazon S3 bucket to upload to.
`acl` | `--acl` | | ACL to set on each uploaded object. Defaults to `public-read`.
`checkOngoingInvalidations` | &nbsp; | | Do not upload changed files if the CloudFront distribution has ongoing invalidations. Experimental. Defaults to `false`.
`concurrency` | `--concurrency` | | Max number of files to upload simultaneously. Defaults to `5`.
 &nbsp; | `--config` | | Path to a JSON file to load options from.
`distributionId` | `--distribution` | `DISTRIBUTION_ID` | CloudFront distribution ID to create invalidations in.
`dryRun` | `--dry-run` | | Do everything normally, just don't actually upload anything.
`granularInvalidation` | `--granular-invalidation` | | Create invalidations for individual changed files. Normally the entire distribution is invalidated with `/*`.
`keyPrefix` | `--key-prefix` | | Prefix for S3 object keys. A trailing slash is always added to the CLI option if one is not given.
`checkMD5` | `--no-check-md5` | | Disable to not check for changed files based on MD5 hashes. Probably don't use this with `granularInvalidation`.
`setMD5` | `--no-set-md5` | | Disable setting MD5 checksum metadata on uploaded files.

## IAM permissions

You should give any script like this AWS credentials with no more access rights than the script actually needs. Here are samples of the minimal IAM policies this utility needs to work.

### S3

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::mybucket"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:GetObjectAcl",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::mybucket/*"
            ]
        }
    ]
}
```

### CloudFront

AWS does not support allowing `cloudfront:CreateInvalidation` for specific distributions, therefore the permission must be granted to all resources. Also, `cloudfront:ListInvalidations` is only needed if `checkOngoingInvalidations` is enabled.

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:ListInvalidations"
            ],
            "Resource": "*"
        }
    ]
}
```
