# Deployment

The app deploys to two targets, both from prebuilt GHCR images:

| Target | How | Workflow |
|--------|-----|----------|
| **AET Kubernetes cluster** | Helm chart `helm/calorieasy` (ingress-nginx → web nginx) | `.github/workflows/deploy-aet.yml` |
| **Azure VM** | Terraform (provision) + Ansible (Docker Compose) | `.github/workflows/deploy-azure.yml` |

Images for all services are built and pushed to GHCR by
`.github/workflows/build-images.yml` (`linux/amd64`).

## Images

`ghcr.io/aet-devops26/team-password123/<service>:<tag>` for
`auth-service`, `meals-service`, `analytics-service`, `genai-service`, `web`.
Tags: `latest` and the commit SHA.

## AET Kubernetes cluster

**Manual:**

```bash
# one-time: create the GHCR pull secret (token needs read:packages)
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=<user> \
  --docker-password=$(gh auth token) -n team-password123

cd helm/calorieasy
helm upgrade --install app . --namespace team-password123
```

**CI:** `deploy-aet.yml` runs automatically **after** `build-images.yml` ("Build &
Push Images") succeeds on `main` (via `workflow_run`), or on manual dispatch. It
deploys by the built **commit SHA** (immutable tag) so every release guarantees a
rollout instead of leaving pods on a stale `latest`. Build runs first, deploy second —
no race.

Secrets / vars (repo → Settings → Secrets and variables → Actions):

| Name | Kind | Purpose |
|------|------|---------|
| `KUBECONFIG_B64` | secret | `base64 -w0 ~/.kube/config` of the `stud` kubeconfig |
| `GHCR_PULL_TOKEN` | secret | token with `read:packages` for the pull secret |
| `LOGOS_BASE_URL` | secret | AET Logos OpenAI-compatible endpoint (text LLM + insights) |
| `LOGOS_API_KEY` | secret | Logos API key |
| `GEMINI_API_KEY` | secret | Google AI Studio key → genai primary vision (Gemini) |
| `OPENROUTER_API_KEY` | secret | OpenRouter key → genai backup vision (Nemotron) |
| `APP_JWT_SECRET` | secret | Shared JWT signing key |
| `POSTGRES_PASSWORD` | secret | Postgres password |
| `GRAFANA_ADMIN_PASSWORD` | secret | Grafana admin login |
| `LOGOS_MODEL` | var | Text LLM model name (default `openai/gpt-oss-120b`) |

## Azure VM

**One-time provisioning (run locally, or via the workflow with a remote backend):**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/calorieasy_id   # keypair for the VM
cd infra/terraform
terraform init
terraform apply -var "ssh_public_key=$(cat ~/.ssh/calorieasy_id.pub)"
terraform output public_ip
```

**Deploy the stack with Ansible:**

```bash
cd infra/ansible
ansible-playbook -i "<vm-ip>," playbook.yml -u azureuser \
  --private-key ~/.ssh/calorieasy_id \
  -e ghcr_user=<user> -e ghcr_token=<read:packages token> \
  -e postgres_password=<pw> -e jwt_secret=<secret> \
  -e openai_base_url=<logos-url> -e openai_api_key=<logos-key>
```

The app is then reachable at `http://<vm-ip>/`.

**CI:** `deploy-azure.yml` validates Terraform on every relevant push and deploys
the stack to the **existing** VM via Ansible (on dispatch / push to `main`). The VM
is provisioned out-of-band (Terraform above, run once); CI only configures + deploys.

Secrets / vars:

| Name | Kind | Purpose |
|------|------|---------|
| `AZURE_PUBLIC_IP` | var | VM public IP |
| `AZURE_USER` | var | SSH user on the VM |
| `AZURE_PRIVATE_KEY` | secret | SSH private key for the VM |
| `POSTGRES_PASSWORD` | secret | postgres password (**required**) |
| `APP_JWT_SECRET` | secret | shared JWT secret (**required**) |
| `GHCR_PULL_TOKEN` | secret | VM `docker login ghcr.io` (only if images are private) |
| `LOGOS_BASE_URL` / `LOGOS_API_KEY` | secret | genai → Logos (optional) |
