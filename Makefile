IMAGE ?= ysskrishna/cron-gui
VER ?= $(shell node -p "require('./package.json').version")
TAG ?= v$(VER)
PLATFORMS ?= linux/amd64,linux/arm64

.PHONY: docker-build docker-push docker-run release

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

release:
	@test -z "$$(git status --porcelain)" || (echo "error: working tree is not clean"; exit 1)
	@if git rev-parse "$(TAG)" >/dev/null 2>&1; then \
		echo "error: tag $(TAG) already exists"; exit 1; \
	fi
	git tag "$(TAG)"
	git push origin "$(TAG)"
	@echo "Pushed $(TAG). Actions: Create Release → Publish npm + Docker."
