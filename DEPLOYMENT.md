# Deployment

The app deploys to two targets, both from prebuilt GHCR images:

| Target | How | Workflow |
|--------|-----|----------|
| **AET Kubernetes cluster** | Helm chart `helm/calorieasy` (Traefik LB in-namespace) | `.github/workflows/deploy-aet.yml` |
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

**CI:** `deploy-aet.yml` runs on push to `main` (paths `helm/**`) or manual dispatch.

Secrets / vars (repo → Settings → Secrets and variables → Actions):

| Name | Kind | Purpose |
|------|------|---------|
| `KUBECONFIG_B64` | secret | `base64 -w0 ~/.kube/config` of the `stud` kubeconfig |
| `GHCR_PULL_TOKEN` | secret | token with `read:packages` for the pull secret |
| `LOGOS_BASE_URL` | secret | AET Logos OpenAI-compatible endpoint |
| `LOGOS_API_KEY` | secret | Logos API key |
| `LOGOS_MODEL` | var | model name (default `gpt-4o`) |

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

**CI:** `deploy-azure.yml` validates Terraform on every relevant push, and
(on dispatch / push to `main`) provisions + deploys. Enable the azurerm remote
backend in `infra/terraform/versions.tf` before relying on repeated CI applies.

Secrets:

| Name | Purpose |
|------|---------|
| `ARM_CLIENT_ID` / `ARM_CLIENT_SECRET` / `ARM_SUBSCRIPTION_ID` / `ARM_TENANT_ID` | Azure service principal |
| `AZURE_SSH_PUBLIC_KEY` / `AZURE_SSH_PRIVATE_KEY` | VM SSH keypair |
| `GHCR_PULL_TOKEN` | VM `docker login ghcr.io` to pull images |
| `POSTGRES_PASSWORD` / `APP_JWT_SECRET` | app secrets |
| `LOGOS_BASE_URL` / `LOGOS_API_KEY` | genai → Logos |

Create the service principal with:

```bash
az ad sp create-for-rbac --name calorieasy-cd \
  --role Contributor --scopes /subscriptions/<sub-id>
```
