.PHONY: deploy logs run-local

# Normally GitHub Actions deploys main after the gates pass. For a manual
# release, export the Railway token, service ID and public URL first.
deploy:
	bash deploy/railway/deploy.sh

# Both processes write to the Railway service's log stream.
logs:
	railway logs --service "$${RAILWAY_SERVICE_ID:?Set RAILWAY_SERVICE_ID}" --lines 100

run-local:
	bun run dev:public --keep-webhooks
