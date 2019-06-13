**ssup** (**S**tatic **S**ite **Up**loader) is a command line utility for uploading static websites to Amazon S3.

## Features

* **Clean URLs** Uploads HTML files without their extension and `Content-Type` set to `text/html`. To preserve normal directory index behavior, any file called `index.html` will keep its extension, but the content type is still set.
* **Upload only changed files** The MD5 hash of each file is saved in S3 metadata as `content-md5` which is checked before reupload to only update and invalidate changed files.
* **CloudFront invalidation** Invalidations can be generated for a CloudFront distribution either to invalidate the entire distribution with `/*` (the default) or to only invalidate changed files.

## Configuration

There are a number of ways to configure how *ssup* works:
* Environment variables
* Command line options
* Configuration file called `.ssuprc.json` in the source directory.
* A configuration file specified with the `--config` command line option. If this is given, the `.ssuprc.json` file is ignored.

The following table lists all available configuration options and the different ways each can be set:

Option | CLI | Env | Description
-- | --- | --- | ---
`sourceDirectory` | The first unnamed argument | &nbsp; | **(Required)** The base directory to upload from.
`bucket` | `--bucket` | `BUCKET` | **(Required)** Amazon S3 bucket to upload to.
`accessKeyId` | &nbsp; | `AWS_ACCESS_KEY_ID` |AWS access key ID
`secretAccessKey` | &nbsp; | `AWS_SECRET_ACCESS_KEY` | AWS access secret
`acl` | `--acl` | | ACL to set on each uploaded object. Defaults to `public-read`.
`checkOngoingInvalidations` | &nbsp; | | Do not upload changed files if the CloudFront distribution has ongoing invalidations. Experimental. Defaults to `false`.
`concurrency` | `--concurrency` | | Max number of files to upload simultaneously. Defaults to `5`.
 &nbsp; | `--config` | | Path to a JSON file to load options from.
`distributionId` | `--distribution` | `DISTRIBUTION_ID` | CloudFront distribution ID to create invalidations in.
`dryRun` | `--dry-run` | | Do everything normally, just don't actually upload anything.
`granularInvalidation` | `--granular-invalidation` | | Create invalidations for individual changed files. Normally the entire distribution is invalidated with `/*`.
`keyPrefix` | `--key-prefix` | | Prefix for S3 object keys. A trailing slash is always added to the CLI option if one is not given.
`checkMD5` | `--check-md5`<br>`--no-check-md5` | | Check for changed files based on the `content-md5` metadata header. Don't disable this if you're using `granularInvalidation`. Defaults to `true`.
`setMD5` | `--set-md5`<br>`--no-set-md5` | | Set the `content-md5` metadata entry for uploaded files. Defaults to `true`.
&nbsp; | `--quiet` | | Suppress informational messages.

## Quirks

* If a configuration file is explicitly specified with `--config`, any `.ssuprc.json` file in the source directory is ignored.
* Files which exist in the bucket but not in the source directory are **not** deleted. This is an *upload* tool, not a *sync* tool.
* All files and directories starting with a `.` are ignored.
* An S3 metadata entry with the key `content-md` is created for each uploaded file, containing a Base64-encoded MD5 hash of the file's contents. This is used for detecting changed files to avoid unnecessary uploads, and for generating item lists for granular CloudFront invalidations.
* Files with the extension `.html` are uploaded without the extension, except if they're called `index.html`. This behavior is, like, 50% of the whole point of this application but is mentioned here in case you didn't read the beginning of this file.

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

AWS does not support allowing `cloudfront:CreateInvalidation` for specific distributions, therefore the permission must be granted to all resources with `"*"`.

Note: `cloudfront:ListInvalidations` is only needed if `checkOngoingInvalidations` is enabled.

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
