test:
	yarn test
.PHONY: test

build:
	yarn build
.PHONY: build

lint: build
	yarn lint
.PHONY: lint

docker: build
	docker build .
.PHONY: docker

check: test lint
.PHONY: check
