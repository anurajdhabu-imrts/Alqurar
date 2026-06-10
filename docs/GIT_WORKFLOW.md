# TRUST OS — Git Workflow Guide

> This document is for every developer on the TRUST OS project.  
> Read it once. Follow it every time. No exceptions.

---

## Overview

We use **3 permanent branches**:

| Branch    | Purpose                                      |
|-----------|----------------------------------------------|
| `main`    | Production-ready code only. Client-facing.   |
| `staging` | QA testing before it goes to main.           |
| `dev`     | Active development. All PRs target this.     |

**You never push directly to `main`, `staging`, or `dev`.**  
All work happens on a short-lived feature/fix branch that gets merged via a Pull Request.

---

## Branch Naming Convention

| Type       | Format                        | Example                        |
|------------|-------------------------------|--------------------------------|
| Feature    | `feature/short-description`   | `feature/farmer-registration`  |
| Bug fix    | `fix/short-description`       | `fix/login-token-expiry`       |
| Hotfix     | `hotfix/short-description`    | `hotfix/otp-crash`             |
| Chore/CI   | `chore/short-description`     | `chore/update-dependencies`    |

Keep names lowercase, use hyphens, no spaces.

---

## Commit Message Format

We follow **Conventional Commits**. Every commit must look like this:

```
type(scope): short description
```

**Types:**

| Type     | When to use                              |
|----------|------------------------------------------|
| `feat`   | Adding a new feature                     |
| `fix`    | Fixing a bug                             |
| `chore`  | Config, dependencies, tooling            |
| `docs`   | Documentation only                       |
| `style`  | Formatting, no logic change              |
| `refactor` | Code restructure, no behavior change   |
| `test`   | Adding or updating tests                 |

**Scopes** (use the module your change belongs to):

`m1`, `m2`, `m3`, `m4`, `m5`, `web`, `mobile`, `backend`, `ci`, `infra`

**Examples:**
```
feat(m1): add farmer registration form
fix(m2): resolve JWT expiry on refresh
chore(ci): add GitHub Actions PR validation
docs(web): update component README
```

---

## Step-by-Step Workflow

### Step 1 — Sync your local `dev` before starting anything

Always start from the latest `dev`. Never create a branch from an outdated base.

```bash
git checkout dev
git fetch origin dev
git pull origin dev
```

---

### Step 2 — Create your feature branch

```bash
git checkout -b feature/your-branch-name
```

Example:
```bash
git checkout -b feature/farmer-registration
```

You are now on your own branch. `dev` is untouched.

---

### Step 3 — Do your work

Write your code. Save your files.

---

### Step 4 — Stage and commit your changes

```bash
git add .
git commit -m "feat(m1): add farmer registration form"
```

Use a proper commit message as described above. One commit per logical unit of work.

---

### Step 5 — Push your branch to GitHub

```bash
git push origin feature/your-branch-name
```

Example:
```bash
git push origin feature/farmer-registration
```

---

### Step 6 — Raise a Pull Request on GitHub

1. Go to the repository on GitHub
2. You will see a banner: **"Compare & pull request"** — click it
3. Set the base branch to **`dev`** (not `main`, not `staging`)
4. Write a short PR title using the same commit format: `feat(m1): farmer registration`
5. In the description, briefly mention what you did and what to test
6. Click **"Create pull request"**

> If you do not see the banner, go to **Pull requests → New pull request**, select your branch, and set base to `dev`.

---

### Step 7 — Wait for PR review and merge

- Rajvardhan will review and merge the PR using **Squash and merge**
- Once merged, the branch is **deleted from GitHub automatically**

---

### Step 8 — Clean up your local after merge

After your PR is accepted and merged, do the following on your local machine:

**Switch back to dev:**
```bash
git checkout dev
```

**Pull the latest dev (which now includes your merged work):**
```bash
git pull origin dev
```

**Delete your local feature branch:**
```bash
git branch -D feature/your-branch-name
```

If you are unsure of the exact branch name, list all branches first:
```bash
git branch -a
```

**Remove stale remote tracking refs:**
```bash
git fetch --prune
```

Your local is now clean and fully up to date with `dev`.

---

## Full Command Reference (Quick Copy)

```bash
# --- START OF NEW TASK ---
git checkout dev
git fetch origin dev
git pull origin dev
git checkout -b feature/your-branch-name

# --- AFTER YOUR WORK ---
git add .
git commit -m "feat(scope): description"
git push origin feature/your-branch-name

# (Raise PR on GitHub → base: dev → Create pull request)

# --- AFTER PR IS MERGED ---
git checkout dev
git pull origin dev
git branch -D feature/your-branch-name
git fetch --prune
```

---

## Rules — Non-Negotiable

1. **Never push directly to `dev`, `staging`, or `main`** — always go through a PR
2. **Always set base branch to `dev`** when creating a PR, never `main`
3. **One task = one branch = one PR** — do not mix multiple features in one branch
4. **Delete your local branch after merge** — keep your local clean
5. **Run `git fetch --prune` after every merge** — removes stale remote references
6. **Use conventional commit messages** — Husky will reject commits that don't follow the format
7. **Never force-push** — if you have a conflict, resolve it properly

---

## Common Mistakes and Fixes

### "I forgot to pull dev before creating my branch"
```bash
# Stash your work first
git stash

# Switch to dev and pull
git checkout dev
git pull origin dev

# Create the correct branch from fresh dev
git checkout -b feature/your-branch-name

# Restore your work
git stash pop
```

### "My PR has a conflict with dev"
```bash
# On your feature branch
git fetch origin dev
git rebase origin/dev

# Resolve conflicts in your editor, then
git add .
git rebase --continue
git push origin feature/your-branch-name --force-with-lease
```

### "I accidentally committed to dev directly"
Tell Rajvardhan immediately. Do not push. He will guide the fix.

---

## Who Owns What

| Module / Area       | Owner(s)              |
|---------------------|-----------------------|
| Web (React + TS)    | Nikhil, Shradha       |
| Mobile (Expo RN)    | Anuraj                |
| Backend (FastAPI)   | Rajvardhan, Anuraj    |
| CI/CD, Infra        | Rajvardhan            |

---

*Last updated: April 2026 | TRUST OS V1.0 | IMR Tech Solutions*
