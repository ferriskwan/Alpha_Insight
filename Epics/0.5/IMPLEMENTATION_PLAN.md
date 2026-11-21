# Implementation Plan — Epic 0.5: CI/CD Pipeline and Cloud Run Multi-Environment Deployment

## 1. Overview & Objective
This Implementation Plan defines the technical execution steps to establish an automated, zero-secret CI/CD deployment pipeline between GitHub (`ferriskwan/Alpha_Insight`) and Google Cloud Platform (project `gen-lang-client-0632004807`).

The pipeline enforces:
1. **Automated CI Testing**: Pull Request validation running Ruff, Mypy, Vitest, and Pytest.
2. **Automated DEV Deployment**: Direct deployment to Cloud Run `alpha-insight-web-dev` and `alpha-insight-daily-job-dev` connecting to `4leafclover_dev` on Cloud SQL (`gen-lang-client-0632004807:asia-southeast1:clover`) upon merging into `dev`.
3. **Gated PROD Deployment**: Production release to `alpha-insight-web` and `alpha-insight-daily-job` connecting to `4leafclover` upon merging `dev` into `main`, protected by GitHub Environment approval.

---

## 2. Technical Scope & Affected Files

### A. Core Configuration Updates
- [`backend/config.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/config.py):
  - Enhance Unix Domain Socket URI construction: When `DB_HOST` starts with `/cloudsql/`, format SQLAlchemy URI as `postgresql+psycopg2://{user}:{password}@/{dbname}?host={db_host}` without injecting a TCP port, ensuring seamless Cloud SQL Auth Proxy socket compatibility on Cloud Run.

### B. CI/CD Pipeline Workflows
- [`.github/workflows/ci-gate.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/ci-gate.yml):
  - Triggers on PRs to `dev` and `main`.
  - Installs uv, python 3.11, node 20.
  - Runs Tier 1 (Ruff format & check), Tier 2 (Mypy backend & Vite tsc), Tier 3 (Pytest 85 tests & Vitest 81 tests).
- [`.github/workflows/deploy-dev.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-dev.yml):
  - Triggers on push/merge to `dev`.
  - Authenticates via Workload Identity Federation (WIF).
  - Starts Google Cloud SQL Auth Proxy in runner background.
  - Executes `uv run alembic upgrade head` against `4leafclover_dev`.
  - Builds and pushes Docker images (`Dockerfile.web` and `Dockerfile.job`) to `asia-southeast1-docker.pkg.dev/gen-lang-client-0632004807/alpha-insight-repo/`.
  - Deploys `alpha-insight-web-dev` to Cloud Run (`asia-southeast1`) with `--add-cloudsql-instances`, environment variables, and Secret Manager references.
  - Deploys `alpha-insight-daily-job-dev`.
  - Probes `/api/health` on the deployed dev URL.
- [`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml):
  - Triggers on push/merge to `main`.
  - Enforces GitHub Environment `production` manual approval gate.
  - Authenticates via WIF, starts Cloud SQL Proxy, and runs `alembic upgrade head` against `4leafclover`.
  - Deploys `alpha-insight-web` and `alpha-insight-daily-job`.
  - Probes `/api/health` on production URL.

### C. Infrastructure Automation Scripts
- [`scripts/setup_gcp_dev.ps1`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/setup_gcp_dev.ps1) & [`scripts/setup_gcp_dev.sh`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/setup_gcp_dev.sh):
  - Automates API enablement, Artifact Registry creation, Service Account provisioning, IAM role grants, Workload Identity Pool/Provider setup, and Secret Manager placeholders.

### D. Documentation Artifacts
- [`Epics/0.5/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/0.5/PRD.md): Product Requirements Document.
- [`Epics/0.5/GCP_SETUP_GUIDE.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/0.5/GCP_SETUP_GUIDE.md): Step-by-step runbook for running setup scripts, setting GitHub secrets/vars, and configuring branch protection rules.
- [`Epics/0.5/WALKTHROUGH.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/0.5/WALKTHROUGH.md): Verification report mapping delivered workflows against all success criteria.

---

## 3. Skill Allocation
- `spec-orchestrator`: Architecture validation, PRD governance, and implementation alignment.
- `logic-generator`: Authoring GitHub Actions workflows, PowerShell/Bash infrastructure setup scripts, and refining `backend/config.py`.
- `deterministic-resolver`: Running Ruff, Mypy, and full test suite verification locally to ensure 100% CI pass rate.

---

## 4. Execution Steps & Verification Strategy

1. **Step 1: Refine `backend/config.py` for Cloud SQL Unix Sockets**
   - Implement Unix domain socket handling when `DB_HOST` starts with `/cloudsql/`.
   - Verify unit tests pass: `uv run pytest tests/backend/test_api_endpoints.py`.
2. **Step 2: Author CI Validation Gate (`ci-gate.yml`)**
   - Configure multi-language test matrix (Python 3.11 with `uv`, Node 20 with `npm`).
   - Validate YAML syntax.
3. **Step 3: Author Deployment Workflows (`deploy-dev.yml` & `deploy-prod.yml`)**
   - Integrate Workload Identity Federation OIDC actions (`google-github-actions/auth`).
   - Integrate Cloud SQL Proxy for zero-friction schema migrations prior to container deployment.
   - Configure Cloud Run parameters: `--region asia-southeast1`, `--port 8080`, `--memory 1Gi`, `--cpu 1`, `--min-instances 0`, `--max-instances 5`.
4. **Step 4: Author Infrastructure Setup Scripts (`scripts/setup_gcp_dev.*`)**
   - Script all `gcloud` provisioning commands with idempotent checks.
5. **Step 5: Author Step-by-Step Operator Guide (`GCP_SETUP_GUIDE.md`)**
   - Clear instructions detailing exact variables for GitHub Actions repository settings (`WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`).
6. **Step 6: Run Fast Targeted Gate & Commit/Push to `epic-0.5`**
   - Run Ruff, Mypy, Vitest, Pytest.
   - Commit all Epic 0.5 files and push to `origin epic-0.5`.
