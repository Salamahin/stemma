build-any-lambda:
	cp -r api_impl_aws_lambda/target/scala-2.13/classes/* $(ARTIFACTS_DIR)


build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/java/lib
	cp -r api/target/pack/lib/*.jar $(ARTIFACTS_DIR)/java/lib

build-StemmaFunction: build-any-lambda
