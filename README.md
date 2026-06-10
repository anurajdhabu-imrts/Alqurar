# TRUST OS V1.0

AI-powered precision agriculture platform for residue-free, export-quality farming.

**Client:** Agrythm Technologies Pvt Ltd (ATPL), Bidar, Karnataka
**Built by:** IMR Tech Solutions

---

## Monorepo Structure

```
trust-os/
├── apps/web/          React + TypeScript + Vite (Web Dashboard)
├── apps/mobile/       React Native + Expo (Farmer Mobile App)
├── apps/backend/      Python + FastAPI (API Server)
├── packages/          Shared types, UI components, utilities
├── docs/              Documentation
│   └── redis-wsl-setup.md   Redis + WSL installation guide
└── infra/             Config files
```

---

## Prerequisites

Install these once on your machine **before running `bash setup.sh`**.

| Tool            | Version | Install                                                                                |
| --------------- | ------- | -------------------------------------------------------------------------------------- |
| Python          | 3.12.x  | `winget install Python.Python.3.12` or [python.org](https://www.python.org/downloads/) |
| uv              | latest  | `pip install uv`                                                                       |
| Node.js         | 22.x    | [nodejs.org](https://nodejs.org/) or `nvm install 22 && nvm use 22`                    |
| nvm (Windows)   | latest  | [nvm-windows](https://github.com/coreybutler/nvm-windows)                              |
| Redis (via WSL) | latest  | See **[docs/redis-wsl-setup.md](docs/redis-wsl-setup.md)**                             |
| PostgreSQL      | 15+     | [postgresql.org](https://www.postgresql.org/download/)                                 |

> No Docker required.

---

## Redis Setup (WSL)

Redis runs inside **Windows Subsystem for Linux (WSL)**.

**Full installation guide → [docs/redis-wsl-setup.md](docs/redis-wsl-setup.md)**

Quick summary:

```cmd
wsl --install -d Ubuntu          # install WSL + Ubuntu (restart after)
wsl --set-default Ubuntu         # set Ubuntu as default
```

Then inside Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y redis-server
sudo service redis-server start
redis-cli ping                   # should reply PONG
```

**⚠️ Complete the Redis WSL setup before running `bash setup.sh`.**

---

## First-time Setup

### 1. Clone and enter the repo

```bash
git clone https://github.com/IMR-Tech-Solutions/trust-os.git
cd trust-os
git checkout dev
```

### 2. Ensure Redis is running

```cmd
wsl redis-cli ping
```

Must reply `PONG`. If not — complete [docs/redis-wsl-setup.md](docs/redis-wsl-setup.md) first.

### 3. Create local database

Open psql or pgAdmin and run:

```sql
CREATE DATABASE trustos_local;
```

### 4. Run the setup script

```bash
bash setup.sh
```

This will:

- Confirm Redis is running (exits with instructions if not)
- Auto-create `apps/backend/.env` and prompt you to fill it in
- Install Python 3.12 deps via `uv sync`
- Run database migrations
- Install Node deps via `npm install`
- Auto-create `apps/web/.env`

---

## Running the App

After setup, just run **one command** to start everything:

```bash
bash dev.sh
```

This opens 3 terminals automatically:

- Redis (via WSL)
- Backend on `http://localhost:8000`
- Frontend on `http://localhost:5173`

### Or start manually (3 terminals):

**Terminal 1 — Redis**

```cmd
wsl sudo service redis-server start
```

**Terminal 2 — Backend**

```bash
cd apps/backend
uv run uvicorn app.main:app --host 0.0.0.0 --reload
```

> If you are testing from a physical phone, make sure the phone and computer are on the same network and use your computer’s LAN IP in mobile config, for example `http://192.168.x.y:8000/api/v1`.

**Terminal 3 — Frontend**

```bash
cd apps/web
npm run dev
```

---

## Daily Commands

### One command (recommended)

```bash
bash dev.sh    # starts Redis + backend + frontend in 3 terminals
```

### With `make`

```bash
make backend                        # start backend
make frontend                       # start frontend
make migrate                        # apply DB migrations
make migrate-new msg="add thing"    # create new migration
make seed                           # seed roles, permissions, superadmin
make redis-check                    # verify Redis (ping)
make help                           # list all commands
```

### Manual

```bash
wsl sudo service redis-server start                           # Redis
cd apps/backend && uv run uvicorn app.main:app --reload       # Backend
cd apps/web && npm run dev                                    # Frontend
cd apps/backend && uv run alembic upgrade head                # Migrations
cd apps/backend && uv run python -m app.seed                  # Seed
```

---

## Git Workflow

```
main  <--  staging  <--  dev  <--  feature/your-task
```

1. Always branch off `dev`

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/m1-your-task
   ```

2. Commit using Conventional Commits format

   ```
   feat(m1): add farmer registration page
   fix(m2): correct JWT expiry logic
   chore(ci): update node version
   ```

3. Rebase onto latest dev before raising PR

   ```bash
   git fetch origin
   git rebase origin/dev
   ```

4. Open PR targeting `dev` — assign Rajvardhan as reviewer

5. Never push directly to `dev`, `staging`, or `main`

---

## Branch Naming

| Type    | Pattern                  | Example                          |
| ------- | ------------------------ | -------------------------------- |
| Feature | `feature/mX-description` | `feature/m1-farmer-registration` |
| Bug fix | `fix/mX-description`     | `fix/m2-jwt-expiry`              |
| Hotfix  | `hotfix/description`     | `hotfix/login-crash`             |

---

## Team

| Name       | Role                            | Owns                          |
| ---------- | ------------------------------- | ----------------------------- |
| Rajvardhan | Backend + Architecture + DevOps | FastAPI, DB, CI/CD, LLM       |
| Nikhil     | Web Frontend                    | M1, M2, M3 web screens        |
| Shradha    | Web Frontend                    | M4, M5 web screens, dashboard |
| Anuraj     | Mobile + Backend support        | React Native, Expo            |
| Prachi     | QA                              | Testing                       |

---

## Troubleshooting

**Redis not running**

```cmd
wsl redis-cli ping
```

If no PONG → follow [docs/redis-wsl-setup.md](docs/redis-wsl-setup.md)

**`make: command not found`**
Use `bash setup.sh` or `bash dev.sh` instead.
Or install make: `winget install GnuWin32.Make` then restart terminal.

**`uv: command not found`**

```bash
pip install uv
```

Close and reopen terminal after installing.

**`asyncpg` or `pydantic-core` build error**
You are on Python 3.13+. Install 3.12:

```bash
winget install Python.Python.3.12
uv sync --python 3.12
```

**Alembic can't connect to database**
Check `DATABASE_URL` in `apps/backend/.env` and make sure `trustos_local` database exists.

**Port 8000 already in use**

```bash
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```
