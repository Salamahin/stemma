#!/bin/bash
set -e
set -x
export html_assets_bucket="stemma-app-appbucket-7y5tmwzrhdzw"
export cloudfront_distribution_id="EK907L1QOXWMF"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

aws s3 sync $SCRIPT_DIR/../client/public/build s3://$html_assets_bucket/ \
 --delete

id=$(aws cloudfront create-invalidation \
    --distribution-id $cloudfront_distribution_id \
    --paths "/*" | 	jq -r .Invalidation.Id)


aws cloudfront wait invalidation-completed \
--distribution-id $cloudfront_distribution_id \
--id $id

echo "ok" $id
