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

## Install / upgrade

```bash
helm upgrade --install app . --namespace team-password123
```

## Access

No ingress host is wired by default. Reach the app via port-forward:

```bash
kubectl port-forward -n team-password123 svc/web 8080:80
# open http://localhost:8080
```

For external access, set `ingress.host` to the AET ingress hostname:

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
