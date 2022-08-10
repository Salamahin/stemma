build-any-lambda:
	cp -r api_impl_aws_lambda/target/scala-2.13/classes/* $(ARTIFACTS_DIR)


build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/java/lib
	cp -r api/target/scala-2.13/stemma-api.jar $(ARTIFACTS_DIR)/java/lib

build-ListStemmasFunction: build-any-lambda
build-DeleteStemmaFunction: build-any-lambda
build-CreateNewStemmaFunction: build-any-lambda
build-StemmaFunction: build-any-lambda
build-DeletePersonFunction: build-any-lambda
build-UpdatePersonFunction: build-any-lambda
build-CreateInvitationTokenFunction: build-any-lambda
build-BearInvitationTokenFunction: build-any-lambda
build-CreateFamilyFunction: build-any-lambda
build-UpdateFamilyFunction: build-any-lambda
build-DeleteFamilyFunction: build-any-lambda
