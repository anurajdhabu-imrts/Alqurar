# Trust OS — Developer shortcuts
# Requires: uv, nvm, redis (local)

.PHONY: setup redis backend frontend migrate migrate-new seed help

# ── One-time setup ────────────────────────────────────────────────────────────

setup: ## First-time setup: install all dependencies
	@echo ">>> Installing backend dependencies..."
	cd apps/backend && uv sync --python 3.12
	@echo ">>> Installing frontend dependencies..."
	cd apps/web && npm install
	@echo ""
	@echo "Setup complete!"
	@echo "  1. Make sure Redis is running:  redis-server"
	@echo "  2. Copy and fill in .env:       cp apps/backend/.env.example apps/backend/.env"
	@echo "  3. Run migrations:              make migrate"
	@echo "  4. Start backend:               make backend"
	@echo "  5. Start frontend:              make frontend"

# ── Redis ─────────────────────────────────────────────────────────────────────

redis: ## Start local Redis server (keep this terminal open)
	redis-server

redis-check: ## Check if Redis is running
	redis-cli ping

# ── Backend ───────────────────────────────────────────────────────────────────

backend: ## Run backend dev server (hot reload)
	cd apps/backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate: ## Run Alembic migrations
	cd apps/backend && uv run alembic upgrade head

migrate-new: ## Create new migration  (usage: make migrate-new msg="add something")
	cd apps/backend && uv run alembic revision --autogenerate -m "$(msg)"

seed: ## Run database seed (roles, permissions, superadmin)
	cd apps/backend && uv run python -m app.seed

# ── Frontend ──────────────────────────────────────────────────────────────────

frontend: ## Run frontend dev server
	cd apps/web && npm run dev

build: ## Build frontend for production
	cd apps/web && npm run build

# ── Help ──────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
