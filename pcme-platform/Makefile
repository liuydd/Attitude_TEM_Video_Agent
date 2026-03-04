.PHONY: dev-up dev-down server-dev server-test server-lint client-dev client-typecheck instructor-dev instructor-build instructor-typecheck

# Infrastructure (optional – only needed if using PostgreSQL)
# dev-up:
# 	docker compose up -d
# 	@echo "Waiting for PostgreSQL..."
# 	@sleep 2
# 	@docker compose exec postgres pg_isready -U pcme

dev-down:
	docker compose down

# Server
server-dev:
	cd server && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

server-test:
	cd server && uv run pytest -v

server-lint:
	cd server && uv run ruff check . && uv run ruff format --check .

server-format:
	cd server && uv run ruff format .

# Client
client-dev:
	cd packages/lab-client && pnpm dev

client-typecheck:
	cd packages/lab-client && pnpm tsc --noEmit

client-build:
	cd packages/lab-client && pnpm build

# Instructor Dashboard
instructor-dev:
	cd packages/instructor-dashboard && pnpm dev

instructor-typecheck:
	cd packages/instructor-dashboard && pnpm tsc --noEmit

instructor-build:
	cd packages/instructor-dashboard && pnpm build

# All – no Docker needed for Phase 1
dev: server-dev
