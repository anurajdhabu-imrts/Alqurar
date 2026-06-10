# 🌱 TRUST OS — AgriTech SaaS Platform

Production-grade React + TypeScript frontend for precision agriculture.

## Quick Start

```bash
npm install
npm run dev        # development server (http://localhost:5173)
npm run build      # production build
npm run preview    # preview production build
```

## Demo Login Credentials

| Role            | Email                   | Password  |
|-----------------|-------------------------|-----------|
| Administrator   | admin@trustos.in        | password  |
| Farm Manager    | manager@trustos.in      | password  |
| Field Officer   | officer@trustos.in      | password  |
| Farmer          | farmer@trustos.in       | password  |
| Ops Manager     | ops@trustos.in          | password  |

> Admin login requires 2FA — enter any 6-digit code.

## Architecture

```
src/
├── types/           # All TypeScript interfaces
├── store/           # Zustand global state (auth, ui)
├── services/        # Axios API service layer
├── hooks/           # TanStack Query hooks + useWebSocket
├── lib/             # Utilities (cn, formatters)
├── mocks/           # Mock data + API interceptor
├── components/
│   ├── ui/          # Button, Input, Card, Table, Modal, Badge…
│   └── layout/      # Sidebar, Topbar, AppLayout
└── features/
    ├── auth/        # Login, 2FA, ProtectedRoute
    ├── dashboard/   # Role-aware dashboard with charts
    ├── farmers/     # CRUD table, registration form, QR, geo
    ├── soil/        # File upload, nutrients, dosage, timeline
    ├── iot/         # 13-param cards, real-time WebSocket, charts
    ├── advisory/    # AI advisory, compliance gate, SMS preview
    ├── geoai/       # Image upload, anomaly detection, confidence
    ├── simulator/   # What-if yield modelling
    ├── notifications/ # Notification centre
    └── settings/    # Language, profile, notification prefs
```

## Tech Stack

| Concern           | Library               |
|-------------------|-----------------------|
| Framework         | React 19 + TypeScript |
| Build             | Vite + @tailwindcss/vite |
| Styling           | Tailwind CSS v4       |
| State             | Zustand + persist     |
| Data fetching     | TanStack Query v5     |
| HTTP client       | Axios                 |
| Forms             | React Hook Form + Zod |
| Charts            | Recharts              |
| Real-time         | WebSocket hook (auto-reconnect) |
| Routing           | React Router v7       |
| File upload       | react-dropzone        |

## Design Tokens

```css
--color-primary:      #78CC40   /* Green */
--color-primary-dark: #4A9E2A   /* Dark green */
--color-primary-light:#A8E06D   /* Light green */
--color-blue:         #4A90E2
--color-yellow:       #FFB800
```

## RBAC Matrix

| Feature           | Admin | Farm Mgr | Field Off | Farmer | Ops Mgr |
|-------------------|:-----:|:--------:|:---------:|:------:|:-------:|
| Dashboard         | ✅    | ✅       | ✅        | ✅     | ✅      |
| Farmer Management | ✅    | ✅       | ✅        | —      | —       |
| Soil & Nutrients  | ✅    | ✅       | ✅        | —      | —       |
| IoT Dashboard     | ✅    | ✅       | ✅        | —      | ✅      |
| AI Advisory       | ✅    | ✅       | ✅        | ✅     | —       |
| Geo AI            | ✅    | ✅       | ✅        | —      | —       |
| What-If Simulator | ✅    | ✅       | —         | —      | —       |
