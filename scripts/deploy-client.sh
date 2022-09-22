#!/bin/bash
set -e
set -x
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

stack_name="eg-stemma-app"
html_assets_bucket=$(aws cloudformation describe-stacks --stack-name $stack_name \
| jq -r '[.Stacks[0].Outputs[] | {key: .OutputKey, value: .OutputValue}] | from_entries' \
| jq -r '.HtmlAssetsBucketRegionalName')



aws s3 sync $SCRIPT_DIR/../eg-html-federation s3://$html_assets_bucket \
 --delete



cloudfront_distribution_id=$(aws cloudformation describe-stacks --stack-name $stack_name \
| jq -r '[.Stacks[0].Outputs[] | {key: .OutputKey, value: .OutputValue}] | from_entries' \
| jq -r '.CloudFormationId')


id=$(aws cloudfront create-invalidation \
    --distribution-id $cloudfront_distribution_id \
    --paths "/*" | 	jq -r .Invalidation.Id)


aws cloudfront wait invalidation-completed \
--distribution-id $cloudfront_distribution_id \
--id $id

echo "ok" $id
