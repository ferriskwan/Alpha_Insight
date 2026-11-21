# Production Cutover Runbook — Epic 1.0 (`Alpha_Insight` → `4leafclover`)

**GCP Project**: `gen-lang-client-0632004807`  
**Region**: `asia-southeast1`  
**Cloud SQL Instance**: `gen-lang-client-0632004807:asia-southeast1:clover`  
**Production Database**: `4leafclover`  
**New Cloud Run Web Service**: `alpha-insight-web-prod`  
**Legacy Services (Parallel Coexistence)**: `alphainsight`, `fourleafclover-dataops`

---

## 1. Pre-Cutover Backup (Mandatory Before Approving `production` Gate)

Automated backups remain disabled on Cloud SQL instance `clover`. Take a one-time backup of `4leafclover` before merging `dev` → `main` or approving `deploy-prod.yml`.

### Option A: One-Time Cloud SQL SQL Export to GCS
```powershell
gcloud.cmd sql export sql clover gs://<YOUR_BACKUP_BUCKET>/4leafclover_pre_epic_1_0_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql `
  --database=4leafclover `
  --project=gen-lang-client-0632004807
```

### Option B: One-Time Local `pg_dump` (via Cloud SQL Auth Proxy or Authorized IP)
```powershell
pg_dump "postgresql://postgres:<PROD_DB_PASSWORD>@<DB_HOST>:5432/4leafclover?sslmode=require" `
  --format=custom `
  --file="4leafclover_pre_epic_1_0_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```
Verify the resulting dump/SQL file exists and is non-empty before proceeding.

---

## 2. Capture Pre-Cutover Baseline Snapshot (Read-Only)

Run [`scripts/verify_prod_cutover.py`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/verify_prod_cutover.py) against `4leafclover` (enforces PostgreSQL `readonly=True` session mode):

```powershell
$env:DB_NAME="4leafclover"
$env:DB_USER="agent_account_1"
$env:DB_PASSWORD="<PROD_DB_PASSWORD>"
$env:DB_PUBLIC_IP="<CLOUD_SQL_PUBLIC_IP>"
uv run python scripts/verify_prod_cutover.py --mode pre --output Epics/1.0/prod_pre_cutover_snapshot.json
```

Expected output: `16 tables, alembic_version=None`.

---

## 3. Git Promotion Sequence (`feat/epic-1.0-production-cutover` → `dev` → `main`)

1. Push `feat/epic-1.0-production-cutover` to `origin` after Full CI-Parity Gate passes locally.
2. Open Pull Request `feat/epic-1.0-production-cutover` → `dev`:
   - Wait for `.github/workflows/ci-gate.yml` (all 4 jobs green).
   - Merge into `dev`.
   - Confirm `.github/workflows/deploy-dev.yml` deploys `alpha-insight-web-dev` and passes `/api/health`.
3. Open Pull Request `dev` → `main`:
   - Wait for `.github/workflows/ci-gate.yml` (all 4 jobs green).
   - Merge into `main`.
4. Approve the `production` GitHub Environment gate on the triggered `.github/workflows/deploy-prod.yml` workflow run:
   - Workflow runs `uv run alembic upgrade head` (`0001` → `0009`) against `4leafclover` via Cloud SQL Proxy.
   - Workflow builds and pushes `alpha-insight-web` image to Artifact Registry.
   - Workflow creates/deploys Cloud Run service **`alpha-insight-web-prod`** (no `alpha-insight-daily-job` is created).
   - Workflow probes `GET <WEB_URL>/api/health` and verifies HTTP 200 `{"status":"ok","env":"PRD"}`.

---

## 4. Post-Cutover Verification

### 4.1 Automated Read-Only Database Verification
```powershell
uv run python scripts/verify_prod_cutover.py `
  --mode post `
  --baseline Epics/1.0/prod_pre_cutover_snapshot.json `
  --output Epics/1.0/prod_post_cutover_snapshot.json
```
Expected output: `POST-CUTOVER VERIFICATION PASSED (4leafclover): 28 tables, alembic_version=['0009'], zero data loss.`

### 4.2 Register Google OAuth Authorized JavaScript Origin
1. Retrieve the provisioned URL:
   ```powershell
   gcloud.cmd run services describe alpha-insight-web-prod `
     --region=asia-southeast1 `
     --project=gen-lang-client-0632004807 `
     --format="value(status.url)"
   ```
2. Open **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs** (`alpha-google-client-id`).
3. Add the `alpha-insight-web-prod` URL to **Authorized JavaScript origins** and save.

### 4.3 Live Functional & Legacy Coexistence Checks
1. Sign in to `alpha-insight-web-prod` with Google SSO and verify:
   - Portfolio Overview loads live `4leafclover` data with default currency `SGD`.
   - Transactions, Watchlist, Stock Analysis, Investment Notes, and Admin Panel load without console or API errors.
2. Verify legacy services remain healthy:
   - `https://fourleafclover-dataops-db25tnv5aa-as.a.run.app` responds normally.
   - `https://alphainsight-db25tnv5aa-as.a.run.app` loads portfolio data from `4leafclover`.

---

## 5. Rollback Procedure

### 5.1 Application Rollback
Legacy `alphainsight` and `fourleafclover-dataops` remain live throughout cutover. To revert traffic immediately:
```powershell
gcloud.cmd run services delete alpha-insight-web-prod `
  --region=asia-southeast1 `
  --project=gen-lang-client-0632004807
```

### 5.2 Database Rollback (Only If Required)
Migrations `0001` and `0004` have no-op downgrades; `alembic downgrade base` removes only the 11 new `Alpha_Insight` tables and deletes `DEFAULT_CURRENCY` from `sysvalue`:
```powershell
$env:ENV="PRD"
$env:DB_NAME="4leafclover"
$env:DB_USER="postgres"
$env:DB_PASSWORD="<PROD_DB_PASSWORD>"
$env:DB_PUBLIC_IP="<CLOUD_SQL_PUBLIC_IP>"
uv run alembic downgrade base
```
For full point-in-time restoration to the pre-cutover state, restore the dump created in Section 1 using `pg_restore` or `gcloud sql import sql`.
