# GCP & GitHub CI/CD Setup Guide — Epic 0.5

This runbook provides step-by-step instructions to configure Google Cloud Platform and GitHub repository settings for automated deployment to Cloud Run.

---

## 1. Prerequisites

- Google Cloud SDK (`gcloud`) installed and logged in as project owner/admin (`gcloud auth login`).
- Target GCP Project: `gen-lang-client-0632004807`
- Cloud SQL Instance: `gen-lang-client-0632004807:asia-southeast1:clover`
- GitHub Repository: [`ferriskwan/Alpha_Insight`](https://github.com/ferriskwan/Alpha_Insight)

---

## 2. Execute Infrastructure Setup Automation

Run the provided automation script to enable APIs, create the Artifact Registry repository, configure Workload Identity Federation (WIF), and bind IAM roles.

### Using PowerShell (Windows):
```powershell
cd c:\Users\ferri\devt\Alpha_Insight
.\scripts\setup_gcp_dev.ps1
```

### Using Bash (macOS/Linux/Cloud Shell):
```bash
cd c/Users/ferri/devt/Alpha_Insight
chmod +x ./scripts/setup_gcp_dev.sh
./scripts/setup_gcp_dev.sh
```

---

## 3. Populate Secret Manager Payloads

The setup script provisions secret placeholders. Populate them with your actual credentials:

```bash
# 1. Database Passwords
echo -n "YOUR_DEV_DB_PASSWORD" | gcloud secrets versions add alpha-db-password-dev --data-file=- --project=gen-lang-client-0632004807
echo -n "YOUR_PROD_DB_PASSWORD" | gcloud secrets versions add alpha-db-password --data-file=- --project=gen-lang-client-0632004807

# 2. AI & Market Data API Keys
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add alpha-gemini-api-key --data-file=- --project=gen-lang-client-0632004807
echo -n "YOUR_TWELVEDATA_API_KEY" | gcloud secrets versions add alpha-twelvedata-api-key --data-file=- --project=gen-lang-client-0632004807

# 3. Google OAuth & Auth Tokens
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets versions add alpha-google-client-id --data-file=- --project=gen-lang-client-0632004807
echo -n "YOUR_DEV_API_KEY" | gcloud secrets versions add alpha-api-key-dev --data-file=- --project=gen-lang-client-0632004807
echo -n "YOUR_PROD_API_KEY" | gcloud secrets versions add alpha-api-key --data-file=- --project=gen-lang-client-0632004807
```

---

## 4. Configure GitHub Repository Variables

Navigate to **GitHub Repository ➔ Settings ➔ Secrets and variables ➔ Actions ➔ Variables tab**:

Add two repository variables (output by the setup script):
- `WIF_PROVIDER`:
  `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `WIF_SERVICE_ACCOUNT`:
  `github-actions-deployer@gen-lang-client-0632004807.iam.gserviceaccount.com`

---

## 5. Configure GitHub Environment for Production Gate

Navigate to **GitHub Repository ➔ Settings ➔ Environments**:
1. Click **New environment** and enter name: `production`.
2. Under **Deployment protection rules**, check **Required reviewers**.
3. Add your GitHub account (`ferriskwan`) as the required reviewer.
4. Click **Save protection rules**.

When code is merged from `dev` into `main`, GitHub Actions will pause `deploy-prod.yml` and require you to click **Review deployments ➔ Approve and deploy** before deploying to `alpha-insight-web` and `4leafclover`.

---

## 6. Configure Branch Protection Rules

Navigate to **GitHub Repository ➔ Settings ➔ Branches**:

### Rule 1: Branch pattern `main`
- Check **Require a pull request before merging**.
- Check **Require approvals** (minimum 1 approval).
- Check **Require status checks to pass before merging**:
  - Add `Tier 1: Ruff Lint & Format`
  - Add `Tier 2: Static Type Integrity`
  - Add `Tier 3: Backend Automated Test Suite`
  - Add `Tier 3: Frontend Vitest Suite`
- Check **Require branches to be up to date before merging**.
- Check **Do not allow bypassing the above settings**.

### Rule 2: Branch pattern `dev`
- Check **Require a pull request before merging**.
- Check **Require status checks to pass before merging** (same 4 CI gate tiers).
- Check **Require branches to be up to date before merging**.

---

## 7. Verification Checklist

1. Push feature branch to GitHub and open PR into `dev`.
2. Confirm `.github/workflows/ci-gate.yml` executes and passes all 4 tiers.
3. Merge PR into `dev` ➔ Verify `.github/workflows/deploy-dev.yml` automatically triggers, applies migrations to `4leafclover_dev`, builds and pushes images, deploys `alpha-insight-web-dev`, and verifies HTTP 200 on `/api/health`.
4. Open PR from `dev` into `main` ➔ Verify CI gate passes.
5. Merge PR into `main` ➔ Verify `.github/workflows/deploy-prod.yml` pauses for manual approval, and upon sign-off, deploys to `alpha-insight-web` with target database `4leafclover`.
