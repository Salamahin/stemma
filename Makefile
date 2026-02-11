build-any-lambda:
	cp -r backend/src/api_impl_aws_lambda/target/scala-2.13/classes/* $(ARTIFACTS_DIR)


build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/java/lib
	cp -r backend/src/api/target/pack/lib/*.jar $(ARTIFACTS_DIR)/java/lib
	rm -f $(ARTIFACTS_DIR)/java/lib/flyway-core*.jar

build-StemmaFunction: build-any-lambda

build-MigrationFunction:
	cp -r backend/src/migration_lambda/target/scala-2.13/classes/* $(ARTIFACTS_DIR)
	mkdir -p $(ARTIFACTS_DIR)/lib
	cp backend/src/api/target/pack/lib/flyway-core*.jar $(ARTIFACTS_DIR)/lib/
