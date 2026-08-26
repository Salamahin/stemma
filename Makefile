build-MyLayer:
	mkdir -p $(ARTIFACTS_DIR)/python
	pip install \
		-r backend/requirements.txt \
		--target $(ARTIFACTS_DIR)/python \
		--platform manylinux_2_28_aarch64 \
		--platform manylinux2014_aarch64 \
		--implementation cp \
		--python-version 3.14 \
		--only-binary=:all: \
		--upgrade

# StemmaFunction publishes versions (SnapStart), so requirements.txt rides along in its
# bundle purely to move the zip hash when dependencies change. Without it a deps-only deploy
# leaves the code byte-identical, SAM publishes no new version, and `live` keeps serving the
# previous layer. McpFunction has no alias, so it always runs $LATEST and needs no such nudge.
build-StemmaFunction:
	cp -r backend/src/stemma $(ARTIFACTS_DIR)/
	cp backend/requirements.txt $(ARTIFACTS_DIR)/

build-McpFunction:
	cp -r backend/src/stemma $(ARTIFACTS_DIR)/
