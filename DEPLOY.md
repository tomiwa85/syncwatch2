# Deploying the SyncWatch backend

The desktop app is just the UI — it talks to the backend (`packages/server`) over
HTTPS/WebSocket. To make the app work for everyone (not just on a machine running
the server locally), deploy the backend to a public URL, then rebuild the client
pointing at it.

The backend is containerized (`Dockerfile` at the repo root) and uses your existing
**Neon** Postgres. It runs `prisma migrate deploy` on startup, then the server.

---

## 1. Environment variables the host must set

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string (the same pooled URL in `packages/server/.env`). |
| `JWT_ACCESS_SECRET` | A fresh random secret (see below). |
| `JWT_REFRESH_SECRET` | A different fresh random secret. |
| `CORS_ORIGIN` | Any web origin you'll serve (e.g. `http://localhost:5173`). The desktop app is allowed regardless — it has no web origin. |
| `ACCESS_TOKEN_TTL` | `15m` |
| `REFRESH_TOKEN_TTL` | `30d` |
| `PORT` | `4000` (some hosts inject their own — the server honors `PORT`). |

Generate two production secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # run twice
```

---

## 2. Deploy (pick one host)

Your project isn't a git repo yet, so **Fly.io** and **Railway CLI** are easiest —
they deploy the local folder directly. **Render** needs a GitHub repo.

### Option A — Fly.io (recommended, deploys local folder, supports WebSockets)

```bash
# install once: https://fly.io/docs/flyctl/install/
fly auth login
fly launch --no-deploy            # detects Dockerfile + fly.toml; pick a unique app name
fly secrets set \
  DATABASE_URL="postgresql://…neon…" \
  JWT_ACCESS_SECRET="…" \
  JWT_REFRESH_SECRET="…" \
  CORS_ORIGIN="http://localhost:5173"
fly deploy
fly open /api/health              # should return {"ok":true}
```

Your backend URL will be `https://<your-app>.fly.dev`.

### Option B — Railway (CLI, no GitHub needed)

```bash
# install once: npm i -g @railway/cli
railway login
railway init                      # create a new project
railway up                        # builds the Dockerfile and deploys
# then in the Railway dashboard: Variables → add the env vars from step 1,
# and Settings → Networking → Generate Domain
```

### Option C — Render (needs a GitHub repo)

Push this repo to GitHub, then in Render: **New + → Blueprint**, select the repo
(`render.yaml` is picked up). Fill in the `DATABASE_URL` and JWT secrets when prompted.

---

## 3. Point the desktop app at the deployed backend

Once you have the public URL (e.g. `https://syncwatch-server.fly.dev`):

1. Edit **`packages/client/.env`**:
   ```
   VITE_API_BASE_URL=https://syncwatch-server.fly.dev
   VITE_SOCKET_URL=https://syncwatch-server.fly.dev
   ```
2. In **`packages/client/src/renderer/index.html`**, add that host to the CSP
   `connect-src` (alongside the existing entries), e.g.:
   ```
   connect-src 'self' https://syncwatch-server.fly.dev wss://syncwatch-server.fly.dev https: …
   ```
3. Rebuild the desktop app:
   ```bash
   pnpm --filter @syncwatch/client dist        # or dist:dir + zip (see DISTRIBUTION.md)
   ```

Now the packaged app talks to your always-on backend — anyone can sign up and join,
no local server required.

---

## Notes

- **WebSockets**: Fly, Railway, and Render all support them; the client connects over
  `wss://` automatically.
- **Migrations**: run automatically on container start (`prisma migrate deploy`),
  verified to work against Neon's pooled URL.
- **Free tiers sleep**: on free plans the server may cold-start after inactivity; the
  first request wakes it. The client's reconnect logic handles the brief delay.
- **Cost/scale**: 512 MB is plenty for this app. Scale up in the host dashboard if needed.
