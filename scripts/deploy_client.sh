#!/bin/bash
set -e
set -x
export html_assets_bucket="stemma-app-appbucket-1tws50417h1zw"
export cloudfront_distribution_id="E22WOJI3A2N1Q6"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

aws s3 sync $SCRIPT_DIR/../client-demo/ s3://$html_assets_bucket/ \
 --delete \
 --size-only

aws cloudfront create-invalidation \
    --distribution-id $cloudfront_distribution_id \
    --paths "/*"

echo "ok"