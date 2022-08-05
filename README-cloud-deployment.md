# Prerequisites
- Install The AWS Command Line Interface (AWS CLI) https://aws.amazon.com/cli/ 
- Configure aws client specifying provided credentials:
    ```console
    aws configure
    ```
  - AWS Access Key ID=USE_PROVIDED_VALUE
  - AWS Secret Access Key=USE_PROVIDED_VALUE
  - Default region name= [eu-central-1]:

- Install AWS SAM https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html

## Test client is working properly
```console
aws s3 ls
```
# Deploy to aws
```console
sbt 'clean;test;compile;pack' \
&& sam build --cached \
&& sam deploy
```

# Cleanup
aws cloudformation delete-stack --stack-name stemma-app