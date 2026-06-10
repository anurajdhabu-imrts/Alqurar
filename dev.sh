#!/usr/bin/env bash
# Trust OS — start everything in 3 separate terminals
# Run from repo root: bash dev.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================"
echo "  Trust OS — Starting Dev Environment"
echo "========================================"
echo ""

# ── Check Redis first ─────────────────────────────────────────────────────────

echo ">>> Checking Redis..."

REDIS_RUNNING=false

if command -v redis-cli &> /dev/null && redis-cli ping 2>/dev/null | grep -q "PONG"; then
  REDIS_RUNNING=true
elif wsl redis-cli ping 2>/dev/null | grep -q "PONG"; then
  REDIS_RUNNING=true
elif netstat -an 2>/dev/null | grep -q "6379.*LISTEN"; then
  REDIS_RUNNING=true
fi

if [ "$REDIS_RUNNING" = false ]; then
  echo "    Redis not running — starting via WSL..."
  wsl sudo service redis-server start
  sleep 2
  if wsl redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "    Redis started."
  else
    echo ""
    echo "  ERROR: Could not start Redis."
    echo "  Follow the guide: docs/redis-wsl-setup.md"
    echo "  Then re-run: bash dev.sh"
    exit 1
  fi
else
  echo "    Redis already running. Good."
fi

echo ""
echo ">>> Opening Backend terminal..."
mintty --title "Trust OS — Backend" --hold error -e bash --login -i -c "
  cd '$ROOT/apps/backend'
  echo '================================'
  echo '  Trust OS — Backend'
  echo '================================'
  source .venv/Scripts/activate
  uvicorn app.main:app --host 0.0.0.0 --reload
" &

sleep 1

echo ">>> Opening Frontend terminal..."
mintty --title "Trust OS — Frontend" --hold error -e bash --login -i -c "
  cd '$ROOT/apps/web'
  echo '================================'
  echo '  Trust OS — Frontend'
  echo '================================'
  npm run dev
" &

echo ""
echo "========================================"
echo "  All services starting!"
echo "========================================"
echo ""
echo "  Backend  → http://localhost:8000"
echo "  API docs → http://localhost:8000/docs"
echo "  Frontend → http://localhost:5173"
echo "  Redis    → localhost:6379 (WSL)"
echo ""
