# Epic 0.5: CI/CD Pipeline and Cloud Run Multi-Environment Deployment

## 1. Overview & Current State Analysis
Alpha_Insight operates locally in development mode across FastAPI (backend) and Vite React 19 (frontend). The codebase contains multi-stage container build specifications (`Dockerfile.web` and `Dockerfile.job`), an initial `cloudbuild.yaml`, and 8 Alembic schema revisions. Code is hosted on GitHub at `https://github.com/ferriskwan/Alpha_Insight.git`.

This Epic establishes an automated, secure CI/CD pipeline linking GitHub with Google Cloud Platform (project: `gen-lang-client-0632004807`). It provisions and maintains isolated environments on Cloud Run connected to Google Cloud SQL instance `gen-lang-client-0632004807:asia-southeast1:clover`:
1. **Development (`DEV`)**:
   - Web Service: `alpha-insight-web-dev`
   - Daily Job: `alpha-insight-daily-job-dev`
   - Database: `4leafclover_dev`
   - Trigger: Pull Request merge into `dev`.
2. **Production (`PRD`)**:
   - Web Service: `alpha-insight-web`
   - Daily Job: `alpha-insight-daily-job`
   - Database: `4leafclover`
   - Trigger: Pull Request merge from `dev` into `main`, gated by manual environment approval.

---

## 2. Architecture & Service Topology

```
                       [ GitHub Repository ]
                      ferriskwan/Alpha_Insight
                                 │
             ┌───────────────────┴───────────────────┐
             │ Pull Request Merge                    │ Pull Request Merge
             ▼                                       ▼
       [ Branch: dev ]                        [ Branch: main ]
             │                                       │
      GitHub Actions                          GitHub Actions
   (deploy-dev.yml)                        (deploy-prod.yml)
             │                                       │
     Workload Identity                       Workload Identity
        Federation                              Federation
             │                                       │
             ▼                                       ▼
   [ Automated Migrations ]                [ Manual Environment Approval ]
   alembic upgrade head                              │
   (Target: 4leafclover_dev)                         ▼
             │                             [ Automated Migrations ]
             │                             alembic upgrade head
             │                             (Target: 4leafclover)
             ▼                                       │
   [ Artifact Registry ]                             ▼
   asia-southeast1-docker.pkg.dev          [ Artifact Registry ]
             │                             asia-southeast1-docker.pkg.dev
             ▼                                       │
   [ Cloud Run (DEV) ]                               ▼
   • alpha-insight-web-dev                 [ Cloud Run (PROD) ]
   • alpha-insight-daily-job-dev           • alpha-insight-web
             │                             • alpha-insight-daily-job
             ▼                                       │
   [ Cloud SQL (asia-southeast1) ]                   ▼
   Instance: clover                        [ Cloud SQL (asia-southeast1) ]
   Database: 4leafclover_dev               Instance: clover
                                           Database: 4leafclover
```

### Component Details
1. **GitHub Repository**:
   - `dev`: Active integration branch for development. All feature branches merge into `dev` via Pull Request after passing automated CI test gates.
   - `main`: Production release branch. Merges into `main` are restricted strictly to Pull Requests originating from `dev`.
2. **Authentication & Authorization**:
   - Workload Identity Federation (WIF) eliminates long-lived service account JSON keys.
   - GitHub Actions assumes a dedicated IAM service account (`github-actions-deployer@gen-lang-client-0632004807.iam.gserviceaccount.com`) using OpenID Connect (OIDC).
3. **Artifact Registry**:
   - Repository: `alpha-insight-repo` located in `asia-southeast1`.
   - Stores versioned container images for web and daily batch jobs tagged with commit SHA and environment tags (`dev`, `latest`).
4. **Cloud Run Services**:
   - **DEV**:
     - `alpha-insight-web-dev`: Serves FastAPI backend and React 19 SPA frontend bundle.
     - `alpha-insight-daily-job-dev`: Cloud Run Job executing `ProcessData.py` for daily data ingestion against `4leafclover_dev`.
   - **PROD**:
     - `alpha-insight-web`: Production web service connected to `4leafclover`.
     - `alpha-insight-daily-job`: Production scheduled batch job connected to `4leafclover`.
5. **GCP Secret Manager**:
   - Distinct secrets referenced directly by Cloud Run:
     - `alpha-db-password-dev` / `alpha-db-password`
     - `alpha-gemini-api-key`
     - `alpha-twelvedata-api-key`
     - `alpha-google-client-id`
     - `alpha-api-key-dev` / `alpha-api-key`

---

## 3. In-Scope Technical Deliverables

### A. CI/CD Workflow Specifications
1. **`.github/workflows/ci-gate.yml`**:
   - Triggers on Pull Requests targeting `dev` and `main`.
   - Runs deterministic 3-tier validation:
     - Tier 1: Ruff check and format verification.
     - Tier 2: Mypy static typing verification.
     - Tier 3: Vitest (frontend 81 tests) and Pytest (backend 85 tests).
2. **`.github/workflows/deploy-dev.yml`**:
   - Triggers automatically on push/merge to `dev`.
   - Authenticates to GCP via Workload Identity Federation.
   - Runs database migrations (`alembic upgrade head`) against `4leafclover_dev` using Cloud SQL Proxy.
   - Builds web and job container images and pushes to Artifact Registry in `asia-southeast1`.
   - Deploys `alpha-insight-web-dev` and updates `alpha-insight-daily-job-dev`.
   - Executes `/api/health` verification probe.
3. **`.github/workflows/deploy-prod.yml`**:
   - Triggers on push/merge to `main`.
   - Requires manual sign-off in GitHub Actions Environment `production`.
   - Runs database migrations (`alembic upgrade head`) against `4leafclover` using Cloud SQL Proxy.
   - Builds/promotes images and deploys `alpha-insight-web` and `alpha-insight-daily-job`.
   - Executes `/api/health` verification probe against production URL.

### B. Configuration & Runtime Adjustments
1. **Unix Domain Socket Support**:
   - Verify and tune [`backend/config.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/config.py) to support `/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover` without port conflicts.
2. **Cloud SQL Automated Migration Execution**:
   - Automated workflow step utilizing Google Cloud SQL Proxy to run `uv run alembic upgrade head` securely during deployment.

### C. Infrastructure Automation Scripts
1. **`scripts/setup_gcp_dev.ps1` and `scripts/setup_gcp_dev.sh`**:
   - Automates GCP project configuration:
     - Enable APIs (`run`, `sqladmin`, `artifactregistry`, `secretmanager`, `iamcredentials`).
     - Create Artifact Registry `alpha-insight-repo` in `asia-southeast1`.
     - Provision Workload Identity Pool and OIDC Provider for `ferriskwan/Alpha_Insight`.
     - Grant IAM roles (`roles/run.admin`, `roles/artifactregistry.writer`, `roles/cloudsql.client`, `roles/secretmanager.secretAccessor`).
     - Provision Secret Manager keys for development.

### D. Documentation in `Epics/0.5/`
1. [`PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/0.5/PRD.md): Requirements and architecture specification.
2. `IMPLEMENTATION_PLAN.md`: Technical step-by-step implementation tasks.
3. `GCP_SETUP_GUIDE.md`: Step-by-step instructions for project configuration and WIF establishment.
4. `WALKTHROUGH.md`: Verification artifact mapping delivered pipeline against scope requirements.

---

## 4. Success Criteria

| ID | Criterion | Verification Method |
| :--- | :--- | :--- |
| **SC-1** | Automated CI Validation Gate | PRs targeting `dev` run linting, typing, and all 166 tests; blocked if any step fails. |
| **SC-2** | Automated Dev Deployment | Merging PR into `dev` triggers GitHub Actions -> WIF -> builds image -> pushes to Artifact Registry -> deploys `alpha-insight-web-dev` with zero manual intervention. |
| **SC-3** | Dev Database Connectivity | `alpha-insight-web-dev` connects to `4leafclover_dev` on Cloud SQL via Unix socket; `/api/health` returns HTTP 200 `{"status": "ok", "env": "DEV"}`. |
| **SC-4** | Scheduled Dev Job Deployment | `alpha-insight-daily-job-dev` deployed as Cloud Run Job configured to connect to `4leafclover_dev`. |
| **SC-5** | Branching Invariant Enforcement | `main` branch can only be merged via PR from `dev`; direct pushes to `main` and `dev` are blocked. |
| **SC-6** | Production Deployment Gate | Deployments to production require explicit human reviewer sign-off in GitHub Actions Environment `production`, deploying to `alpha-insight-web` and `4leafclover`. |
| **SC-7** | Zero Secret Exposure | No database passwords, tokens, or private service account keys present in git commits, action logs, or built images. |
