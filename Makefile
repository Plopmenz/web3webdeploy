node_modules:
	npm i

.next: node_modules
	npm run build

deploy: .next node_modules
	npm run start
.PHONY: deploy
