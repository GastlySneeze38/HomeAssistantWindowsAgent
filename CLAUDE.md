# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HomeAssistantWindowsAgent** — a Windows desktop agent controllable via a local HTTP API. It lets remote clients (e.g. Home Assistant) launch/close applications and monitor system resources on a Windows PC.

The project has two independent parts:
- **Backend/** — Rust HTTP + WebSocket API (Axum, port 3000)
- **Frontend/** — Electron + React + TypeScript desktop UI (Vite, port 5173)

## Development Commands

### Start both services together
```bat
run-dev.bat
```
This opens two separate terminal windows: one for the Rust API with hot-reload, one for the Vite/Electron dev server.

### Backend (Rust)
```bash
cd Backend
cargo run                        # run once
cargo build --release            # production build
```

### Frontend (Electron + React)
```bash
cd Frontend
npm install
npm run dev          # starts Vite renderer + Electron (waits for Vite to be ready)
npm run build        # Vite production build only
npm start            # launch Electron without Vite dev server
```

## Architecture

### Backend modules (`Backend/src/`)

| Module | Role |
|---|---|
| `main.rs` | Router setup, CORS config, DB init, server bind on `127.0.0.1:3000` |
| `database.rs` | SQLite via `rusqlite` (Mutex-wrapped). Tables: `users`, `tokens`, `history` |
| `auth.rs` | Argon2 password hashing/verification helpers |
| `middleware.rs` | `BearerToken` extractor — parses `Authorization: Bearer <token>` header |
| `handlers.rs` | All HTTP route handlers |
| `ws.rs` | WebSocket handler — pushes `system_update` every second to authenticated clients |
| `init.rs` | Creates a default `admin` user on first launch if no users exist |
| `launcher.rs` | Executes a process via `Command::new` |
| `close.rs` | Kills a process by name |
| `system.rs` | Reads available RAM via `sysinfo` |

**Auth flow:** login → UUID token stored in `tokens` table with 7-day expiry → token passed as `Bearer` header on all subsequent requests. WebSocket auth uses `?token=` query param.

**Setup flow:** On first launch, a default `admin` user is created. The frontend checks `/setup/status` (returns `needs_setup: true` if `admin` still exists). After the user creates a real account and logs in as admin, `POST /setup/finalize` deletes the `admin` user.

**Database file:** `Backend/App.db` (SQLite, created at runtime in the `Backend/` directory).

### Frontend (`Frontend/src/`)

- `App.tsx` — root component; owns all state (token, system info, history, active view); handles login/logout, WS connection, polling history every 5s
- `api.ts` — `apiFetch` wrapper that injects `Authorization` header and throws `"UNAUTHORIZED"` on 401
- `types.ts` — shared TypeScript types
- `LoginPage.tsx` / `SetupWizard.tsx` — rendered before main UI depending on setup/auth state
- `hooks/useWebSocket` — manages WS lifecycle, reconnects when token changes
- `components/Sidebar` — navigation between views: `control`, `history`, `users`
- `components/sections/` — `ControlSection`, `HistorySection`, `UsersSection`

**Electron:** `electron/main.js` creates a `BrowserWindow` loading either `ELECTRON_START_URL` (dev) or the built `index.html` (prod). `electron/preload.js` runs in the renderer context.

### API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check |
| GET | `/setup/status` | No | Check if admin user exists |
| POST | `/setup/finalize` | Bearer | Delete admin user after setup |
| POST | `/login` | No | Returns Bearer token |
| POST | `/logout` | Bearer | Invalidates token |
| GET | `/system` | Bearer | Available RAM |
| POST | `/launch` | Bearer | Launch a process by command string |
| POST | `/close` | Bearer | Kill a process by name |
| GET | `/history` | Bearer | Last 100 actions for the authenticated user |
| POST | `/create_user` | Bearer | Create a new user |
| POST | `/delete_user` | Bearer | Delete a user (requires their password) |
| GET | `/ws` | `?token=` | WebSocket — pushes `system_update` every second |

## Key Constraints

- The backend only binds to `127.0.0.1:3000` — it is not exposed on the network by default.
- The `Database` struct uses a `Mutex<Connection>` (single SQLite connection, not a pool). Avoid long-held locks.
- History is per-user — always scoped by `user_id` from the token.
- `close.rs` kills processes by name; cross-process compatibility is a known TODO item.
