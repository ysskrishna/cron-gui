IMAGE ?= ysskrishna/cron-gui
VER ?= $(shell node -p "require('./package.json').version")
PLATFORMS ?= linux/amd64,linux/arm64

.PHONY: docker-build docker-push docker-run

docker-build:
	docker build -t $(IMAGE):$(VER) -t $(IMAGE):latest .

docker-push:
	docker buildx build --platform $(PLATFORMS) \
		-t $(IMAGE):latest \
		-t $(IMAGE):$(VER) \
		--push .

docker-run:
	docker run --rm -p 8000:8000 \
		-v cron-gui-data:/cron-gui/crontabs \
		$(IMAGE):$(VER)

# Manual fallback when CI is unavailable. Prefer GitHub Releases for production publishes.
release:
	npm publish --provenance --access public
	$(MAKE) docker-push
