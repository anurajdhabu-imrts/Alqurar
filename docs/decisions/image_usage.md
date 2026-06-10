# Image & Asset Usage — TRUST OS

> This document explains where to store shared images, icons, and fonts, and how to use them in web and mobile apps.

---

## Where Assets Live

All shared assets (logo, icons, fonts, images) are stored in one place:

```
packages/assets/
├── images/     ← logo, hero images, backgrounds
├── icons/      ← app icon, favicons, UI icons
└── fonts/      ← custom font files
```

**Never store shared assets inside `apps/web/` or `apps/mobile/`.**  
Those folders are for app-specific files only. Anything used by more than one app goes in `packages/assets/`.

---

## How to Add an Asset

1. Drop the file in the correct subfolder inside `packages/assets/`
2. Commit it on your feature branch like any other code change

```
packages/assets/images/logo.png        ← correct
apps/web/src/assets/logo.png           ← wrong (web-only, not shared)
```

---

## Using Assets in Web (`apps/web/`)

Import directly using the `@trust-os/assets` alias:

```ts
import logo from '@trust-os/assets/images/logo.png'
import appIcon from '@trust-os/assets/icons/app-icon.png'

<img src={logo} alt="TRUST OS" />
```

The alias is configured in:
- `apps/web/vite.config.ts` — Vite resolves the path at build time
- `apps/web/tsconfig.json` — TypeScript understands the alias, no red underlines

---

## Using Assets in Mobile (`apps/mobile/`)

Expo's Metro bundler uses `babel-plugin-module-resolver`.  
When mobile setup is done, add this to `apps/mobile/babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['module-resolver', {
      alias: {
        '@trust-os/assets': '../../packages/assets',
      },
    }],
  ],
}
```

Then import the same way as web:

```ts
import logo from '@trust-os/assets/images/logo.png'

<Image source={logo} style={{ width: 120, height: 40 }} />
```

Same alias. Same folder. One source of truth.

---

## Folder Reference

| Folder                        | What goes here                          |
|-------------------------------|-----------------------------------------|
| `packages/assets/images/`    | Logo, hero images, backgrounds, photos  |
| `packages/assets/icons/`     | App icon, favicon, UI icon PNGs/SVGs    |
| `packages/assets/fonts/`     | Custom `.ttf` / `.otf` font files       |

---

## Rules

1. **One source of truth** — update the asset in `packages/assets/` and both apps get the change automatically
2. **Never duplicate** — do not copy `logo.png` into both `apps/web/` and `apps/mobile/`
3. **Use the alias** — always import via `@trust-os/assets/...`, never use relative paths like `../../../packages/assets/...`
4. **Commit assets on the relevant feature branch** — treat asset files like any other code change

---

*Last updated: April 2026 | TRUST OS V1.0 | IMR Tech Solutions*
