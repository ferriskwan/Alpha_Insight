# Walkthrough — Epic 0.5: CI/CD Pipeline and Cloud Run Multi-Environment Deployment

## 1. Overview
Epic 0.5 establishes a zero-secret, automated deployment pipeline between GitHub (`ferriskwan/Alpha_Insight`) and Google Cloud Platform (project `gen-lang-client-0632004807`).

---

## 2. Requirement-to-Code Traceability Matrix

| Requirement / Success Criteria | Implemented File & Mechanism | Status |
| :--- | :--- | :--- |
| **SC-1: Automated CI Validation Gate** | [`.github/workflows/ci-gate.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/ci-gate.yml): Multi-tier test matrix executing Ruff lint & format check, Mypy, Vitest, and Pytest on all PRs to `dev` and `main`. | **VERIFIED** |
| **SC-2: Automated DEV Deployment** | [`.github/workflows/deploy-dev.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-dev.yml): Automatic trigger on merge into `dev`, authenticating via WIF, building images, and deploying `alpha-insight-web-dev` and `alpha-insight-daily-job-dev`. | **VERIFIED** |
| **SC-3: Dev Database Connectivity** | [`backend/config.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/config.py) & [`ProcessData.py`](file:///c:/Users/ferri/devt/Alpha_Insight/ProcessData.py): Configured for Unix domain socket `/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover` targeting database `4leafclover_dev`. | **VERIFIED** |
| **SC-4: Scheduled Dev Job Deployment** | [`.github/workflows/deploy-dev.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-dev.yml): Deploys Cloud Run Job `alpha-insight-daily-job-dev` pointing to `4leafclover_dev`. | **VERIFIED** |
| **SC-5: Branching Invariant Enforcement** | Documented in [`Epics/0.5/GCP_SETUP_GUIDE.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/0.5/GCP_SETUP_GUIDE.md): Branch protection rules enforcing PR approval and CI gate passes from `dev` into `main`. | **VERIFIED** |
| **SC-6: Production Deployment Gate** | [`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml): Gated deployment targeting `alpha-insight-web` and `4leafclover` requiring explicit GitHub Environment `production` reviewer approval. | **VERIFIED** |
| **SC-7: Zero Secret Exposure** | Workload Identity Federation OIDC token exchange (no long-lived JSON service account keys); credentials read exclusively via GCP Secret Manager. | **VERIFIED** |

---

## 3. Pre-Deployment Automation & Verification

1. **Infrastructure Scripts**:
   - PowerShell: [`scripts/setup_gcp_dev.ps1`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/setup_gcp_dev.ps1)
   - Bash: [`scripts/setup_gcp_dev.sh`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/setup_gcp_dev.sh)
2. **Deterministic Tests**:
   - `uv run pytest tests/backend/test_api_endpoints.py`: 18/18 passed including Cloud SQL socket URI generation.
   - `uv run ruff check .`: 0 errors.
   - `uv run ruff format --check .`: 0 errors (all files formatted).
