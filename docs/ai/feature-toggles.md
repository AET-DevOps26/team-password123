# Feature toggles

Runtime feature flags live in **auth-service** (W07 post-deployment pattern). No redeploy needed to show or hide UI.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/features/{name}` | Returns `true` or `false` (default `false`) |
| `PUT` | `/api/features/{name}?enabled=true` | Enable or disable |
| `GET` | `/api/features` | All flags currently set |

## Vision model picker

| Flag | When `true` |
|------|-------------|
| `scan-vision-model-picker` | Scan modal shows **Auto / Gemini / Nemotron** before **Analyze meal** |

When `false` (default), scans use **`auto`** (Gemini with Nemotron fallback) with no picker visible.

## Local usage

**1. Start services** (from repo root):

```bash
cp .env.example .env                    # set POSTGRES_PASSWORD, GEMINI_API_KEY, OPENROUTER_API_KEY
node scripts/gen-jwt-keys.mjs >> .env   # generate the RS256 JWT keypair
docker compose up --build
```

**2. Enable the picker (PowerShell on Windows — `curl -X PUT` often fails):**

```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:8081/api/features/scan-vision-model-picker?enabled=true"
```

Or bash:

```bash
curl -X PUT "http://localhost:8081/api/features/scan-vision-model-picker?enabled=true"
```

Verify: `Invoke-RestMethod http://localhost:8081/api/features/scan-vision-model-picker` should print `True`.

**3. Use the app:**

- Open http://localhost:3000 (or the web port from compose)
- Log in, open **Scan**
- Choose **Gemini**, **Nemotron**, or **Auto**
- Upload a photo → **Analyze meal**
- Check the overlay: `95% match · Gemini` (or `Nemotron`)

**4. Disable again:**

```bash
curl -X PUT "http://localhost:8081/api/features/scan-vision-model-picker?enabled=false"
```

Hard-refresh the browser after toggling. Opening **Scan** also reloads flags (no full re-login required).

**Windows note:** `curl -X PUT` often fails in PowerShell — use `Invoke-RestMethod -Method Put` (see step 2).

## Production (later)

After deploy, same `PUT` against your prod auth URL (via ingress):

```bash
curl -X PUT "https://<your-host>/api/features/scan-vision-model-picker?enabled=true"
```

Flags are **in-memory** — they reset when auth-service pods restart. Re-apply after rollout if needed.

## Security note

`GET` is public so the SPA can read flags. Consider restricting `PUT` to admins in production (API key, VPN, or authenticated ops role).
