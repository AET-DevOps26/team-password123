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

The chart no longer ships working default secrets. `jwt.secret` and
`postgres.password` are **required** — a deploy without them fails closed.

**Option A — externally-managed Secret (recommended for production).** Create the
Secret once, out-of-band, then point the chart at it. Survives `helm upgrade` and
keeps secrets out of `values.yaml` / shell history / the Helm release:

```bash
kubectl -n team-password123 create secret generic calorieasy-secrets \
  --from-literal=APP_JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 24) \
  --from-literal=OPENAI_API_KEY=<logos-key> \
  --from-literal=USDA_FDC_API_KEY=
# then install with: --set secrets.existingSecret=calorieasy-secrets
```

**Option B — chart-managed Secret.** Pass the same values on every upgrade:

```bash
--set jwt.secret=$(openssl rand -hex 32) --set postgres.password=$(openssl rand -hex 24)
```

> HS256 requires a key of at least 32 bytes (`openssl rand -hex 32` = 64 hex chars).
> Rotate by updating the Secret and `kubectl rollout restart` the three Java
> services — existing JWTs are invalidated and users simply log in again.

## Install / upgrade

```bash
# Option A — external Secret created above:
helm upgrade --install app . --namespace team-password123 \
  --set secrets.existingSecret=calorieasy-secrets

# Option B — chart-managed Secret:
helm upgrade --install app . --namespace team-password123 \
  --set jwt.secret=$(openssl rand -hex 32) \
  --set postgres.password=$(openssl rand -hex 24)
```

## Access

Traefik runs in-namespace as the load balancer / entrypoint. It routes `/` to the
multi-replica web tier and `/api/*` to the backend services, load-balancing each.
Reach the app via port-forward to the Traefik service:

```bash
kubectl port-forward -n team-password123 svc/traefik 8080:80
# open http://localhost:8080
```

For external access, expose Traefik via `traefik.service.type=NodePort` (or
LoadBalancer), or point the cluster ingress at the `traefik` service and set
`ingress.host`:

```bash
helm upgrade --install app . --namespace team-password123 \
  --set ingress.host=<your-host>.ase.cit.tum.de
```

## GenAI / Logos

The genai service defaults to the OpenAI-compatible provider so it can target the
AET Logos gateway. Provide the endpoint and key at install time:

```bash
helm upgrade --install app . --namespace team-password123 \
  --set genai.openaiBaseUrl=<logos-endpoint> \
  --set genai.openaiModel=<model> \
  --set genai.openaiApiKey=<logos-key>
```

Without these the app still runs; photo analysis falls back to manual entry.
