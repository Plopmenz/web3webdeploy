NPM = $(shell node -p "require('../web3webdeploy.config.json').packageManager ?? 'npm'")

node_modules:
	$(NPM) i

.next: node_modules
	$(NPM) run build

deploy: .next node_modules
	$(NPM) run start
.PHONY: deploy
