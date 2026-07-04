# Developer Command Center

A **local-first, E2E-encrypted** developer workspace — manage snippets, markdown notes, canvas diagrams, vault secrets, terminal history, and remote servers in one place.

## Architecture

```
DEV-DASH/
  backend/    Node.js + Express API + Socket.IO + MongoDB + BullMQ
  frontend/   React 18 + Vite SPA
  daemon/     (Phase 2) Local CLI daemon
```

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or cloud)

### 1. Backend

```bash
cd backend
npm install
# edit .env with your MONGODB_URI, REDIS_URL, JWT_SECRET
npm run dev
```

Backend starts on **http://localhost:5000**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on **http://localhost:5173**

## Environment Variables

### backend/.env
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/dev-dash` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JWT_SECRET` | — | Access token secret |
| `JWT_REFRESH_SECRET` | — | Refresh token secret |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1 — Foundation | ✅ MVP | Auth, Workspaces, Artifacts CRUD, Search, Vault (stub E2E), Socket.IO |
| 2 — CLI Daemon | 🔜 | Local daemon, terminal history sync, real E2E crypto, `.env` vault |
| 3 — Remote Manager | 🔜 | SSH/SFTP/FTP browser, Monaco editor, pre-save snapshots |
| 4 — Intelligence | 🔜 | AST parsing, vector search, ER diagrams, canvas linking |

## Security Notes

- Passwords hashed with **Argon2id** (not bcrypt)
- Vault routes only accept **encrypted envelopes** — server never sees plaintext
- JWT access tokens expire in 15 min; refresh tokens rotate on use
- E2E crypto (Phase 2): XChaCha20-Poly1305 via libsodium, per-device key wrapping
