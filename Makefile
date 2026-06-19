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
# Override with SEED_DAYS / SEED_EMAIL / SEED_PASSWORD; pass FORCE=1 to add meals
# even if the range already has data.
seed:
	node scripts/seed.mjs $(if $(FORCE),--force,)
