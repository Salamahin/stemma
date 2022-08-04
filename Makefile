build-any-lambda:
	cp -r api_impl_aws_lambda/target/scala-2.13/classes/* $(ARTIFACTS_DIR)


build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/java
	cp -r api_impl_aws_lambda/target/scala-2.13/*.jar $(ARTIFACTS_DIR)

build-HelloWorldFunction: build-any-lambda
