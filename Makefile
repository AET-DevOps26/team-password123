.PHONY: start up down seed logs

# One command: bootstrap .env (first run only), build + start the full stack,
# wait until the services answer, seed demo data. Idempotent — safe to re-run.
start: .env
	docker compose up --build -d
	@printf 'Waiting for services '
	@t=0; until curl -sf http://localhost:8081/actuator/health >/dev/null \
	         && curl -sf http://localhost:8082/actuator/health >/dev/null \
	         && curl -sf http://localhost:8083/actuator/health >/dev/null; do \
	  t=$$((t+2)); \
	  if [ $$t -ge 300 ]; then echo ' timed out — check: docker compose logs'; exit 1; fi; \
	  printf '.'; sleep 2; \
	done; echo ' up.'
	node scripts/seed.mjs
	@echo 'Ready: http://localhost:3000  (dev@local.com / password123)'

# First-run bootstrap: config + fresh RS256 JWT keypair. Never overwrites an existing .env.
.env:
	cp .env.example .env
	node scripts/gen-jwt-keys.mjs >> .env
	@echo 'Created .env with fresh JWT keys. Optional: add OPENAI_API_KEY for real AI photo scan.'

# Start the full stack (postgres + auth + meals + analytics + web; genai optional).
up:
	docker compose up --build -d

# Stop the stack.
down:
	docker compose down

# Tail logs.
logs:
	docker compose logs -f

# Seed demo data into the running backend via REST (one user + ~10 days of meals).
# Clears the seed user's existing meals first; pass KEEP=1 to append instead.
# Override with SEED_DAYS / SEED_EMAIL / SEED_PASSWORD.
seed:
	node scripts/seed.mjs $(if $(KEEP),--keep,)
