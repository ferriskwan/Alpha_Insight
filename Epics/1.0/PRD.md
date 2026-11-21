# Product Requirements Document (PRD) — Epic 1.0: Production Cutover (`Alpha_Insight` → `4leafclover`)

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.0  
**Branch**: `feat/epic-1.0-production-cutover` (branched from `dev`)  
**Status**: Ready for User Sign-off (`proceed`)  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]` (Production database migration `0001`–`0009`, Cloud Run `alpha-insight-web-prod` provisioning, CI/CD release promotion `dev` → `main`, and PROD legacy schema compatibility fixes)

---

## 1. Objective

Promote `Alpha_Insight` from `dev` (`4leafclover_dev` / `alpha-insight-web-dev`) to production (`main` / `4leafclover` / `alpha-insight-web-prod`) with zero data loss and full backward compatibility with the legacy `4leafclover` services running in parallel.

---

## 2. Current State Analysis

### 2.1 Git Branch State (`ferriskwan/Alpha_Insight`)
- `main` (`96f074e`): Baseline commit (Epics 0.1–0.3). Contains Alembic revisions `0001`–`0004` only. Does not contain `.github/workflows/deploy-prod.yml`.
- `dev` (`2b33907`): Active integration branch through Epic 0.6. Contains Alembic revisions `0001`–`0009` and `.github/workflows/deploy-prod.yml`.
- `feat/epic-1.0-production-cutover`: Feature branch created from `dev` for Epic 1.0 changes. Promotion path: `feat/epic-1.0-production-cutover` → `dev` → `main`.

### 2.2 GCP Production Inventory (`gen-lang-client-0632004807`, `asia-southeast1`)
- **Cloud Run Services**:
  - `alpha-insight-web-dev` (`https://alpha-insight-web-dev-db25tnv5aa-as.a.run.app`) — active DEV web service.
  - `alphainsight` (`https://alphainsight-db25tnv5aa-as.a.run.app`) — legacy PROD Node.js UI (remains live in parallel).
  - `fourleafclover-dataops` (`https://fourleafclover-dataops-db25tnv5aa-as.a.run.app`) — legacy PROD FastAPI DataOps service (remains live in parallel).
  - `alpha-insight-web-prod` — does not exist yet (created by Epic 1.0).
- **Cloud Run Jobs**:
  - `alpha-insight-daily-job-dev` — active DEV batch job.
  - No production `Alpha_Insight` daily job exists; legacy `4leafclover` batch pipeline remains the sole writer of daily market/position/summary batches in PROD.
- **Cloud SQL (`gen-lang-client-0632004807:asia-southeast1:clover`)**:
  - PostgreSQL 18.6 hosting `4leafclover` (PROD) and `4leafclover_dev` (DEV).
  - Automated Cloud SQL backups (`backupConfiguration.enabled: false`) and PITR (`pointInTimeRecoveryEnabled: false`) are disabled and will remain disabled; a one-time pre-cutover `pg_dump` or Cloud SQL GCS export will be taken prior to migration.
- **Secret Manager**:
  - All 5 production secrets exist with `version 1` (`enabled`): `alpha-db-password`, `alpha-api-key`, `alpha-gemini-api-key`, `alpha-twelvedata-api-key`, `alpha-google-client-id`.

### 2.3 Live Database State (`4leafclover` PROD vs. `4leafclover_dev` DEV)
- **PROD `4leafclover`**: 16 tables, `schema_migrations` (`20260724145920`, `20260728091114`), no `alembic_version` table.
  - Verified row counts: `tickdata` (276,553), `eoddata` (12,877), `daily_margin_interest` (5,504), `daily_portfolio_summary` (5,502), `position` (1,847), `exchange_rate` (972), `trade` (61), `capital` (33), `watchlist` (28), `sysvalue` (3), `user_roles` (3), `users` (2), `margin_interest_rate` (2), `schema_migrations` (2), `objective` (0), `user_settings` (0).
- **DEV `4leafclover_dev`**: 28 tables (`alembic_version = '0009'`).
- **PROD-Only Constraints Absent in DEV**:
  - `capital`: `capital_accounttype_check` (`'M'` or `'C'` only), `capital_transtype_check` (`'D'`, `'F'`, `'W'` only).
  - Untouched narrow legacy column widths:
    - `trade`: `symbol varchar(10)`, `buysell char(1)`, `remarks varchar(200)`, `quantity NOT NULL`
    - `watchlist`: `symbol varchar(10)`, `name varchar(64)`, `timezone varchar(20)`, `currency varchar(3)`
    - `eoddata` / `tickdata`: `symbol varchar(10)`, `interval varchar(10)`
    - `daily_portfolio_summary`: `currency varchar(3)`
    - `sysvalue`: `name varchar(20)`, `type varchar(20)`, `strvalue varchar(64)`, `description varchar(200)`
  - Legacy unique indexes without `user_id`: `primaryposition (tradedate, symbol, investment)` and `primarywatchlist (watchlistname, symbol)`.

---

## 3. Architecture Alignment

```
[feat/epic-1.0-production-cutover] ──PR──▶ [dev] ──PR (CI Gate)──▶ [main]
                                                                      │
                                                       GitHub Actions: deploy-prod.yml
                                                       (Manual Gate: `production`)
                                                                      │
                              ┌───────────────────────────────────────┴───────────────────────────────────────┐
                              ▼                                                                               ▼
          [One-Time Pre-Cutover Backup]                                                [Alembic Upgrade Head (0001→0009)]
          Local pg_dump / Cloud SQL GCS Export                                         Cloud SQL Proxy → 4leafclover (PRD)
                                                                                                              │
                                                                                                              ▼
                                                                                       [Cloud Run: alpha-insight-web-prod]
                                                                                       ENV=PRD, DB_NAME=4leafclover
                                                                                       Unix Socket: /cloudsql/...:clover
                                                                                       Secrets: Secret Manager
                                                                                                              │
                                                                                       [Parallel Coexistence with Legacy]
                                                                                       • alphainsight (UI)
                                                                                       • fourleafclover-dataops (API/Batch)
```

- **Cloud Run Web Service**: `alpha-insight-web-prod` in `asia-southeast1` (`1Gi` RAM, `1` CPU, `min-instances=0`, `max-instances=10`, port `8080`, `--allow-unauthenticated`).
- **Cloud Run Daily Job**: Excluded from `deploy-prod.yml` in Epic 1.0 to avoid concurrent batch write races with legacy `4leafclover`.
- **Database Connectivity**: Unix domain socket `/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover`, `ENV=PRD`, `DB_NAME=4leafclover`, `DB_USER=postgres`, `DB_SSLMODE=disable`.
- **Authentication & Secrets**: GitHub OIDC Workload Identity Federation (`github-actions-deployer@gen-lang-client-0632004807.iam.gserviceaccount.com`); secrets mounted exclusively via GCP Secret Manager.

---

## 4. Functional & Technical Requirements

### 4.1 Pre-Cutover Compatibility Fixes (On `feat/epic-1.0-production-cutover`)
1. **`capital` Account Type Normalization** ([`backend/repositories/portfolio_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py)):
   - Update `create_capital` and `update_capital` so `"LEVERAGE"` / `"L"` maps to `"M"` (instead of `"L"`), matching PROD `capital_accounttype_check` (`'C'` or `'M'`) and legacy `4leafclover` ledger conventions.
   - Validate `transtype` against allowed values `('D', 'F', 'W')` matching PROD `capital_transtype_check` (returning HTTP 422 on invalid codes rather than a database constraint error).
2. **Legacy Column-Length Validation Guards** ([`backend/schemas/transactions.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/transactions.py), [`backend/repositories/portfolio_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py), [`backend/repositories/market_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/market_repo.py), [`backend/repositories/watchlist_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/watchlist_repo.py), [`backend/repositories/sys_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/sys_repo.py)):
   - Enforce input length limits matching untouched PROD legacy column widths so writes cannot trigger `StringDataRightTruncation` on PROD:
     - `trade`: `symbol` ≤ 10 chars, `buysell` ∈ `{'B', 'S'}` (1 char), `remarks` ≤ 200 chars, `quantity` non-null (`NOT NULL` in PROD).
     - `watchlist`: `symbol` ≤ 10 chars, `name` ≤ 64 chars, `timezone` ≤ 20 chars, `currency` ≤ 3 chars.
     - `sysvalue`: `name` ≤ 20 chars, `type` ≤ 20 chars, `strvalue` ≤ 64 chars, `description` ≤ 200 chars.
3. **Production Deployment Workflow Update** ([`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml)):
   - Deploy Cloud Run service named **`alpha-insight-web-prod`** (replacing `alpha-insight-web`).
   - Update Artifact Registry web image tag and `/api/health` probe target to `alpha-insight-web-prod`.
   - Remove the `alpha-insight-daily-job` build and deploy steps from `deploy-prod.yml` so only legacy `4leafclover` executes daily batch calculations in PROD.
4. **Unit Tests**:
   - Add deterministic backend unit tests covering `'L'`/`'Leverage'` → `'M'` capital normalization, `transtype` validation, and legacy column-length validation rules.

### 4.2 Pre-Cutover One-Time Backup & Baseline Audit
1. Execute a one-time full backup of `4leafclover` before running migrations (local `pg_dump` or `gcloud sql export sql` to GCS; leave Cloud SQL automated backups disabled).
2. Capture and record pre-migration row counts for all 16 PROD tables via a read-only verification script.

### 4.3 Production Database Migration (`4leafclover_dev` → `4leafclover`)
Executed automatically by `deploy-prod.yml` (`uv run alembic upgrade head`) against `4leafclover`:
- **`0001`**: No-op (all 13 baseline tables exist).
- **`0002`**: Create `user_sessions`, `job_execution_log` + 2 indexes.
- **`0003`**: Skip `pk_trade` (`trade_pkey` already exists); create `site_map` (17 seeded rows), `audit_log`, `trans_cost`, `ref_chart_settings` (1 global row) + 12 indexes.
- **`0004`**: Alter `public.capital` (widen `accounttype` → `varchar(32)`, `transtype` → `varchar(16)`, `broker` → `varchar(64)`, `currency` → `varchar(16)`). All 33 rows preserved.
- **`0005`**: Create `agent_committee_runs`, `agent_analyst_outputs`, `investment_notes`, `investment_note_analyst_links` + 15 indexes; update `site_map` (`research.stock_analyst` → `research.committee`, 16 final rows).
- **`0006`**: Create `agent_chat_messages` + 4 indexes.
- **`0007`–`0008`**: Convert new `ref_chart_settings` to `JSONB` `parameters` store + 4 partial unique indexes.
- **`0009`**: Insert 1 row `('DEFAULT_CURRENCY', 'STRING', 'SGD')` into `public.sysvalue` (3 existing rows preserved).
- **Result**: 28 total tables (16 legacy + 12 new including `alembic_version = '0009'`), zero legacy tables/columns dropped, zero legacy rows lost.

### 4.4 Code Promotion (`dev` → `main`) & Cutover Execution
1. Merge `feat/epic-1.0-production-cutover` → `dev` via Pull Request after passing `ci-gate.yml` (Ruff check/format, Mypy, Pytest, Vitest).
2. Verify `deploy-dev.yml` deploys `alpha-insight-web-dev` cleanly.
3. Open Pull Request `dev` → `main` and pass `ci-gate.yml`.
4. Confirm one-time `4leafclover` backup is completed and verified.
5. Merge `dev` → `main` and manually approve the GitHub Environment `production` deployment gate in `deploy-prod.yml`.
6. Verify `alpha-insight-web-prod` starts and passes `GET /api/health` (`HTTP 200 {"status":"ok","env":"PRD"}`).

### 4.5 Parallel Coexistence & Google OAuth Cutover Step
1. Legacy `alphainsight` and `fourleafclover-dataops` Cloud Run services remain online and untouched during production validation.
2. Add the provisioned `alpha-insight-web-prod` Cloud Run URL (`https://alpha-insight-web-prod-*.asia-southeast1.run.app`) to Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (`alpha-google-client-id`) **Authorized JavaScript Origins** so Google SSO login works in production.

### 4.6 Rollback Procedure
- **Application Rollback**: Delete or disable traffic on `alpha-insight-web-prod`; legacy `alphainsight` and `fourleafclover-dataops` remain continuously available.
- **Database Rollback (if required)**: Run `alembic downgrade base` (drops only the 11 new tables and deletes `DEFAULT_CURRENCY` from `sysvalue`; `0001` and `0004` downgrades are no-ops) or restore `4leafclover` from the pre-cutover `pg_dump` / GCS export.

---

## 5. Success Criteria (UAT)

| ID | Category | Criterion | Verification Method |
| :--- | :--- | :--- | :--- |
| **SC-1** | Pre-Cutover Backup | Verified one-time backup of `4leafclover` exists before migration | Backup file (`pg_dump` or GCS `.sql`) exists, is non-empty, and pre-migration table row counts are recorded. |
| **SC-2** | CI-Parity Gate | All pre-cutover code and workflow changes pass 3-tier CI gate | `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, `uv run pytest`, `npm test` all exit `0` locally and in `ci-gate.yml`. |
| **SC-3** | PROD Write Compatibility | `Alpha_Insight` writes satisfy PROD constraints | Unit tests and PROD smoke checks confirm `'Leverage'`/`'L'` capital normalizes to `'M'`, invalid `transtype` is rejected, and narrow legacy column lengths are validated. |
| **SC-4** | Zero-Data-Loss Migration | `4leafclover` upgrades cleanly to Alembic `0009` with zero row loss | `alembic_version = '0009'`; 28 total tables; post-migration row counts match pre-migration counts on 15 legacy tables and `sysvalue` = 4 rows. |
| **SC-5** | Cloud Run Provisioning | `alpha-insight-web-prod` is deployed and serving PROD traffic | `gcloud run services describe alpha-insight-web-prod --region asia-southeast1` is `Ready`; `GET /api/health` returns HTTP 200 `{"status":"ok","env":"PRD"}`; no `alpha-insight-daily-job` created. |
| **SC-6** | Legacy Coexistence | Legacy `4leafclover` services continue operating without regression | `fourleafclover-dataops` and `alphainsight` respond normally against `4leafclover` after migration. |
| **SC-7** | Production UI/UX Parity | Production UI renders live `4leafclover` data after OAuth sign-in | Authenticated session on `alpha-insight-web-prod` loads Portfolio Overview (default `SGD`), Transactions, Watchlist, Stock Analysis, and Investment Notes with zero API or console errors. |

---

## 6. Out of Scope
- Enabling automated Cloud SQL backups or PITR on instance `clover`.
- Deploying or scheduling `alpha-insight-daily-job` in production (deferred until post-validation batch cutover).
- Decommissioning legacy `alphainsight` or `fourleafclover-dataops` Cloud Run services.
- Redesigning legacy unique indexes (`primaryposition`, `primarywatchlist`) for multi-user shared symbols.
- Custom domain or DNS mapping.
