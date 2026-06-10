# Redis Setup via WSL (Windows Subsystem for Linux)

This guide walks through installing WSL, Ubuntu, and Redis on Windows.
**Complete this once before running `bash setup.sh`.**

---

## Step 1 — Enable WSL

Open **Command Prompt or PowerShell as Administrator** and run:

```cmd
wsl --install
```

> If it says "WSL is already installed", skip to Step 2.

**Restart your machine** after installation completes.

---

## Step 2 — Install Ubuntu

After restart, open **Command Prompt as Administrator** and run:

```cmd
wsl --install -d Ubuntu
```

If you get error `0x80070005` (Access Denied):
- Make sure you opened CMD as Administrator (right-click → Run as administrator)

If you get a store/network error, install Ubuntu directly:
1. Open **Microsoft Store**
2. Search **Ubuntu**
3. Click **Get** → **Install**
4. Launch Ubuntu from Start menu to finish setup

When Ubuntu launches for the first time it will ask you to **create a username and password** — set anything simple and remember it.

---

## Step 3 — Set Ubuntu as Default WSL Distribution

Open **Command Prompt as Administrator**:

```cmd
wsl --set-default Ubuntu
```

Verify:
```cmd
wsl --list
```
Ubuntu should show **(Default)**.

---

## Step 4 — Install Redis inside Ubuntu

Open **Command Prompt** (normal, no admin needed now) and run:

```cmd
wsl
```

You are now inside Ubuntu. Run:

```bash
sudo apt-get update
sudo apt-get install -y redis-server
```

---

## Step 5 — Start Redis

```bash
sudo service redis-server start
```

Verify it's working:
```bash
redis-cli ping
```

You should see:
```
PONG
```

Type `exit` to leave Ubuntu and go back to Windows.

---

## Step 6 — Auto-start Redis on WSL boot (optional but recommended)

This makes Redis start automatically every time WSL starts — so you never have to manually run `sudo service redis-server start` again.

Inside Ubuntu (run `wsl` to enter):
```bash
sudo nano /etc/wsl.conf
```

Add these lines at the bottom:
```
[boot]
command=service redis-server start
```

Save with `Ctrl+O` → Enter → `Ctrl+X` to exit.

Then restart WSL:
```cmd
wsl --shutdown
wsl
```

Verify Redis started automatically:
```bash
redis-cli ping
```
Should reply `PONG`.

---

## Step 7 — Verify from Windows

Open **Command Prompt** (not inside WSL) and run:

```cmd
wsl redis-cli ping
```

Should reply `PONG`. This confirms Redis inside WSL is accessible from Windows.

---

## Daily Usage

**Start Redis (if not using auto-start):**
```cmd
wsl sudo service redis-server start
```

**Check Redis is running:**
```cmd
wsl redis-cli ping
```

**Your `.env` setting for Redis:**
```
REDIS_URL=redis://localhost:6379/0
```
This is correct — Redis in WSL is accessible at `localhost:6379` from Windows.

---

## Troubleshooting

**`redis-cli: command not found`**
Redis isn't installed yet. Go back to Step 4.

**`Could not connect to Redis`**
Redis service isn't running. Start it:
```cmd
wsl sudo service redis-server start
```

**WSL not found / not recognized**
Your Windows version may not support WSL. Minimum: Windows 10 version 1903 or Windows 11.
Check your version: `winver` in Run dialog.
