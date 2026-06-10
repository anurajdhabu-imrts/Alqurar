#!/usr/bin/env bash
# Trust OS — one-shot setup script
# Run from repo root: bash setup.sh
#
# ⚠️  BEFORE RUNNING THIS SCRIPT:
#     Redis must be installed and running via WSL.
#     If you haven't done that yet, follow the guide first:
#     → docs/redis-wsl-setup.md

set -e

echo ""
echo "========================================"
echo "  Trust OS — Developer Setup"
echo "========================================"
echo ""
echo "  ⚠️  Prerequisites check:"
echo "  Redis must be running via WSL before continuing."
echo "  If not set up yet, see: docs/redis-wsl-setup.md"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────

echo ">>> Checking prerequisites..."

if ! command -v uv &> /dev/null; then
  echo ">>> uv not found — installing..."
  pip install uv
  echo "    uv installed. If 'uv' still not found, close and reopen terminal then re-run."
fi

if ! command -v node &> /dev/null; then
  echo ""
  echo "ERROR: Node.js is not installed."
  echo "  Install Node 22: https://nodejs.org  or via nvm:"
  echo "    nvm install 22 && nvm use 22"
  exit 1
fi

echo "    uv      : $(uv --version 2>/dev/null || echo 'installed')"
echo "    node    : $(node --version)"
echo "    npm     : $(npm --version)"
echo ""

# ── 2. Check Redis (WSL) ──────────────────────────────────────────────────────

echo ">>> Checking Redis on port 6379..."

REDIS_RUNNING=false

if command -v redis-cli &> /dev/null && redis-cli ping 2>/dev/null | grep -q "PONG"; then
  REDIS_RUNNING=true
  echo "    Redis is running. Good."
elif wsl redis-cli ping 2>/dev/null | grep -q "PONG"; then
  REDIS_RUNNING=true
  echo "    Redis is running via WSL. Good."
elif netstat -an 2>/dev/null | grep -q "6379.*LISTEN"; then
  REDIS_RUNNING=true
  echo "    Redis is running on port 6379. Good."
fi

if [ "$REDIS_RUNNING" = false ]; then
  echo ""
  echo "  !! Redis is NOT running."
  echo ""
  echo "  You need to install and start Redis via WSL."
  echo "  Full guide: docs/redis-wsl-setup.md"
  echo ""
  echo "  Quick steps:"
  echo "    1. wsl --install -d Ubuntu     (restart after)"
  echo "    2. wsl --set-default Ubuntu"
  echo "    3. wsl"
  echo "    4. sudo apt-get update && sudo apt-get install -y redis-server"
  echo "    5. sudo service redis-server start"
  echo "    6. redis-cli ping              (should reply PONG)"
  echo "    7. exit                        (back to Windows)"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi

echo ""

# ── 3. Check backend .env ─────────────────────────────────────────────────────

if [ ! -f "apps/backend/.env" ]; then
  echo ">>> Creating apps/backend/.env from example..."
  cp apps/backend/.env.example apps/backend/.env
  echo ""
  echo "  IMPORTANT: Open apps/backend/.env and fill in:"
  echo "    - DATABASE_URL    (your local Postgres connection string)"
  echo "    - JWT_SECRET_KEY  (generate with: openssl rand -hex 32)"
  echo "    - SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD"
  echo ""
  read -p "  Press Enter once you have updated .env to continue..."
else
  echo ">>> apps/backend/.env already exists. Skipping."
fi

echo ""

# ── 4. Backend dependencies ───────────────────────────────────────────────────

echo ">>> Installing backend dependencies (Python 3.12)..."
cd apps/backend
uv sync --python 3.12
echo "    Backend dependencies installed."
echo ""

# ── 5. Run migrations ─────────────────────────────────────────────────────────

echo ">>> Running database migrations..."
uv run alembic upgrade head
echo "    Migrations applied."
echo ""
cd ../..

# ── 6. Frontend dependencies ──────────────────────────────────────────────────

echo ">>> Installing frontend dependencies..."
cd apps/web
npm install
echo "    Frontend dependencies installed."
echo ""
cd ../..

# ── 7. Frontend .env ──────────────────────────────────────────────────────────

if [ ! -f "apps/web/.env" ]; then
  echo ">>> Creating apps/web/.env..."
  cat > apps/web/.env <<EOF
VITE_API_URL=http://127.0.0.1:8000/api/v1
VITE_IMG_URL=http://127.0.0.1:8000/api
EOF
  echo "    apps/web/.env created."
  echo ""
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Every day to start development, just run:"
echo ""
echo "    bash dev.sh"
echo ""
echo "This opens 3 terminals: Redis + Backend + Frontend."
echo ""
