build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/python
	pip install \
		-r backend_py/requirements.txt \
		--target $(ARTIFACTS_DIR)/python \
		--platform manylinux2014_aarch64 \
		--implementation cp \
		--python-version 3.13 \
		--only-binary=:all: \
		--upgrade

build-StemmaFunction:
	cp -r backend_py/src/stemma $(ARTIFACTS_DIR)/

build-MigrationFunction:
	cp -r backend_py/src/stemma $(ARTIFACTS_DIR)/
	cp -r backend_py/migrations $(ARTIFACTS_DIR)/migrations
