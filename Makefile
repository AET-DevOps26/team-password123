.PHONY: up down seed logs

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
