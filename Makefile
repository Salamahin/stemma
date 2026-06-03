build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/python
	pip install \
		-r backend/requirements.txt \
		--target $(ARTIFACTS_DIR)/python \
		--platform manylinux_2_28_aarch64 \
		--platform manylinux2014_aarch64 \
		--implementation cp \
		--python-version 3.13 \
		--only-binary=:all: \
		--upgrade

build-StemmaFunction:
	cp -r backend/src/stemma $(ARTIFACTS_DIR)/
