# Calorieasy Helm chart

Deploys the full stack to Kubernetes: postgres (with schema init), the three
Spring Boot services (auth/meals/analytics), the genai service, and the web
client (nginx serving the SPA and reverse-proxying `/api/*` to the backends).

## Prerequisites

- `kubectl` context pointing at the AET cluster (`stud`), with access to the
  target namespace (`team-password123`).
- Service images pushed to GHCR by `.github/workflows/build-images.yml`.
- A pull secret for the (private) GHCR packages, created out-of-band:

```bash
TOKEN=$(gh auth token)   # token needs read:packages
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<your-github-user> \
  --docker-password="$TOKEN" \
  --namespace team-password123
```

`values.yaml` already references this secret via `imagePullSecrets`.

## Secrets

The chart no longer ships working default secrets. `jwt.privateKey` (secret),
`jwt.publicKey` (not secret) and `postgres.password` are **required** — a deploy
without them fails closed.

JWTs use **RS256**: only auth-service receives the RSA private key
(`APP_JWT_PRIVATE_KEY`, from the Secret) and can issue tokens; meals/analytics
verify with the public key alone (`APP_JWT_PUBLIC_KEY`, a plain env value from
`jwt.publicKey` — it is not sensitive), so compromising a resource service no
longer allows minting tokens. Generate a keypair (headerless single-line base64
of the PKCS#8/SPKI DER, ready for `--set`) with:

```bash
node scripts/gen-jwt-keys.mjs   # prints APP_JWT_PRIVATE_KEY=... / APP_JWT_PUBLIC_KEY=...
```

**Option A — externally-managed Secret (recommended for production).** Create the
Secret once, out-of-band, then point the chart at it. Survives `helm upgrade` and
keeps secrets out of `values.yaml` / shell history / the Helm release:

```bash
kubectl -n team-password123 create secret generic calorieasy-secrets \
  --from-literal=APP_JWT_PRIVATE_KEY=<pkcs8-base64> \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 24) \
  --from-literal=OPENAI_API_KEY=<gemini-key> \
  --from-literal=BACKUP_OPENAI_API_KEY=<openrouter-key> \
  --from-literal=TEXT_OPENAI_API_KEY=<logos-key> \
  --from-literal=USDA_FDC_API_KEY=
# then install with: --set secrets.existingSecret=calorieasy-secrets
# jwt.publicKey is NOT part of the Secret — always pass it as a value:
#   --set jwt.publicKey=<spki-base64>
```

**Option B — chart-managed Secret.** Pass the same values on every upgrade:

```bash
--set jwt.privateKey=<pkcs8-base64> --set jwt.publicKey=<spki-base64> \
--set postgres.password=$(openssl rand -hex 24)
```

> Rotate by generating a new keypair, updating the private key in the Secret and
> `jwt.publicKey`, then `kubectl rollout restart` the three Java services —
> existing JWTs are invalidated and users simply log in again.

## Install / upgrade

```bash
# Option A — external Secret created above:
helm upgrade --install app . --namespace team-password123 \
  --set secrets.existingSecret=calorieasy-secrets \
  --set jwt.publicKey=<spki-base64>

# Option B — chart-managed Secret:
helm upgrade --install app . --namespace team-password123 \
  --set jwt.privateKey=<pkcs8-base64> \
  --set jwt.publicKey=<spki-base64> \
  --set postgres.password=$(openssl rand -hex 24)
```

## Access

The front door is the cluster's ingress-nginx: the Ingress routes `/` to the
`web` Service (the in-pod nginx serves the SPA and reverse-proxies `/api/*` to
the backends) and `/grafana` to Grafana. Load balancing is plain Kubernetes:
kube-proxy spreads connections across the web replicas, and the auth-service
HPA scales 1–4 pods on CPU. Without the ingress, port-forward the web tier:

```bash
kubectl port-forward -n team-password123 svc/web 8080:80
# open http://localhost:8080
```

External access is via the Ingress host:

```bash
helm upgrade --install app . --namespace team-password123 \
  --set ingress.host=<your-host>.ase.cit.tum.de
```

## A/B testing (ingress-nginx canary)

`abTest.*` in `values.yaml` deploys a second web tier (`web-canary`) from any
pushed web image tag and a canary Ingress that sends `abTest.weight`% of new
sessions to it. The primary Ingress gains cookie session-affinity while an
experiment runs, so each user sticks to one variant (index.html and its hashed
assets must come from the same build). QA can force a variant with the
`ab-variant` cookie: `always` → canary, `never` → stable.

Rollout recipe:

1. Mint the B image: `workflow_dispatch` `build-images.yml` on the variant
   branch — it pushes `web:<branch-sha>` to GHCR and does **not** trigger a
   deploy (deploy-aet only fires on main).
2. Dark-launch: commit `abTest: { enabled: true, imageTag: <branch-sha>, weight: 0 }`
   and smoke-test via the cookie override before any real traffic sees it.
3. Raise `weight` via committed values changes (deploy-aet passes no abTest
   flags, so an out-of-band `--set` is reverted on the next main deploy).

Caveats: the `/` split includes `/api/*` (proxied through the web pod), and
nothing emits per-variant metrics yet — add an `X-AB-Variant` header or a
frontend analytics tag to the variant build if you need measurable results.

## GenAI configuration

**Vision (photo scan):** Gemini primary via `OPENAI_*` env vars; OpenRouter Nemotron backup via `BACKUP_OPENAI_*`. Keys come from GitHub Secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) in CI.

**Text (estimate + insights):** AET Logos via `TEXT_OPENAI_*` (`LOGOS_API_KEY` in CI).

```bash
helm upgrade --install app . --namespace team-password123 \
  --set genai.openaiApiKey=<gemini-key> \
  --set genai.backupOpenaiApiKey=<openrouter-key> \
  --set genai.textOpenaiApiKey=<logos-key>
```

Without vision keys the app still runs; photo analysis falls back to manual entry.
