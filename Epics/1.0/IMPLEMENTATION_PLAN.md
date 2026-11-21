# Implementation Plan — Epic 1.0: Production Cutover (`Alpha_Insight` → `4leafclover`)

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.0  
**Branch**: `feat/epic-1.0-production-cutover`  
**PRD Reference**: [`Epics/1.0/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/PRD.md)  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]`  
**Status**: Ready for User Sign-off (`proceed`) & Execution Mode Selection

---

## 1. Technical Scope

### 1.1 Database Objects (Production `4leafclover` via Alembic `0001`–`0009`)
No new Alembic migration files are created in Epic 1.0; existing migrations `0001`–`0009` execute sequentially when `deploy-prod.yml` runs `uv run alembic upgrade head` against `4leafclover`:
- **New Tables (12)**: `alembic_version`, `user_sessions`, `job_execution_log`, `site_map` (16 seeded rows), `audit_log`, `trans_cost`, `ref_chart_settings` (JSONB `parameters` + 1 global row + 4 partial unique indexes), `agent_committee_runs`, `agent_analyst_outputs`, `investment_notes`, `investment_note_analyst_links`, `agent_chat_messages`.
- **Altered Existing Table (1)**: `public.capital` (4 columns widened: `accounttype` → `varchar(32)`, `transtype` → `varchar(16)`, `broker` → `varchar(64)`, `currency` → `varchar(16)`). Existing CHECK constraints (`capital_accounttype_check`, `capital_transtype_check`) and all 33 rows remain intact.
- **Data-Seeded Existing Table (1)**: `public.sysvalue` (+1 row: `('DEFAULT_CURRENCY', 'STRING', 'SGD')`). Existing 3 rows remain intact.
- **Untouched Existing Tables (14)**: `users`, `user_roles`, `user_settings`, `watchlist`, `eoddata`, `tickdata`, `exchange_rate`, `trade`, `position`, `margin_interest_rate`, `daily_margin_interest`, `daily_portfolio_summary`, `objective`, `schema_migrations`.

### 1.2 Files to Modify

| File Path | Functions / Symbols | Specific Changes |
| :--- | :--- | :--- |
| [`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml) | `deploy-prod` job steps | Rename Cloud Run service target from `alpha-insight-web` to `alpha-insight-web-prod`; update health probe lookup (`gcloud run services describe alpha-insight-web-prod`); remove `Build & Push Daily Job Container (PROD)` and `Deploy Cloud Run Job (alpha-insight-daily-job)` steps so legacy `4leafclover` remains the sole PROD daily batch writer. |
| [`backend/schemas/transactions.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/transactions.py) | `WatchlistTransactionInput`, `TradeTransactionInput`, `CapitalTransactionInput`, `SysValueTransactionInput`, shared normalization helper `normalize_capital_accounttype`, `normalize_capital_transtype`, `normalize_trade_buysell` | Add Pydantic `Field(max_length=...)` limits and validators matching untouched PROD legacy column constraints: `WatchlistTransactionInput` (`watchlistname` ≤ 64, `symbol` ≤ 10, `name` ≤ 64, `timezone` ≤ 20, `currency` ≤ 3); `TradeTransactionInput` (`symbol` ≤ 10, `buysell` normalized to `'B'`/`'S'`, `remarks` ≤ 200); `CapitalTransactionInput` (`broker` ≤ 64, `currency` ≤ 16, `accounttype` normalized to `'C'`/`'M'` where `'Leverage'`/`'L'` → `'M'`, `transtype` validated/normalized to `'D'`/`'F'`/`'W'`); `SysValueTransactionInput` (`name` ≤ 20, `type` ≤ 20, `strvalue` ≤ 64, `description` ≤ 200). |
| [`backend/schemas/ref_data.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/ref_data.py) | `SysValueUpdate` | Add `Field(max_length=...)` constraints matching PROD `sysvalue` (`type` ≤ 20, `strvalue` ≤ 64, `description` ≤ 200). |
| [`backend/api/v1/watchlist.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/watchlist.py) | `WatchlistAddRequest` | Add `Field(max_length=...)` constraints matching PROD `watchlist` (`symbol` ≤ 10, `name` ≤ 64, `watchlistname` ≤ 64). |
| [`backend/repositories/portfolio_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py) | `create_capital`, `update_capital` | Replace duplicated inline `accounttype`/`transtype` normalization blocks with calls to the shared helpers `normalize_capital_accounttype` (`'Leverage'`/`'L'` → `'M'`) and `normalize_capital_transtype` (`'D'`/`'F'`/`'W'`), eliminating DRY duplication and preventing PROD `CheckViolation`. |

### 1.3 Files to Create

| File Path | Purpose |
| :--- | :--- |
| [`scripts/verify_prod_cutover.py`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/verify_prod_cutover.py) | Strictly read-only PostgreSQL verification tool (`readonly=True`). Supports `--mode pre` (snapshots all 16 table row counts, `alembic_version`, and constraints to JSON) and `--mode post --baseline <file>` (asserts `alembic_version == '0009'`, 28 tables present, exact row-count parity across 15 legacy tables, `sysvalue` delta = +1, and zero data loss). |
| [`tests/backend/test_prod_compatibility.py`](file:///c:/Users/ferri/devt/Alpha_Insight/tests/backend/test_prod_compatibility.py) | Deterministic unit and API tests verifying: (1) `capital` `'Leverage'`/`'L'` → `'M'`, `'Cash'`/`'C'` → `'C'`, and `transtype` ∈ `{'D', 'F', 'W'}` validation; (2) rejection (HTTP 422) of oversized inputs exceeding PROD legacy column widths (`trade`, `watchlist`, `sysvalue`); (3) `deploy-prod.yml` structural assertions (`alpha-insight-web-prod` service name, `PROD_DB_NAME=4leafclover`, no daily-job deploy step); (4) `verify_prod_cutover.py` pre/post diff logic. |
| [`Epics/1.0/CUTOVER_RUNBOOK.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/CUTOVER_RUNBOOK.md) | Step-by-step operator cutover procedure: one-time `pg_dump` / GCS SQL export of `4leafclover`, pre-migration snapshot, PR `feat/epic-1.0-production-cutover` → `dev`, PR `dev` → `main`, `production` gate approval, post-migration verification, Google OAuth Authorized Origin registration for `alpha-insight-web-prod`, legacy parallel coexistence check, and rollback commands. |

---

## 2. Execution Sequence (End-to-End Cutover Phases)

1. **Phase A — Code & Workflow Preparation (`feat/epic-1.0-production-cutover`)**:
   - Implement schema validation guards, DRY `capital` normalization fix, `deploy-prod.yml` update, `scripts/verify_prod_cutover.py`, `Epics/1.0/CUTOVER_RUNBOOK.md`, and `tests/backend/test_prod_compatibility.py`.
   - Run Full CI-Parity Gate across workspace root `.`:
     - Tier 1: `uv run ruff check .` and `uv run ruff format --check .`
     - Tier 2: `uv run mypy backend tests/backend`
     - Tier 3: `uv run pytest` and `npm.cmd test` + `npm.cmd run typecheck`
2. **Phase B — Pre-Cutover Backup & Baseline Snapshot**:
   - Execute one-time full backup of `4leafclover` (`pg_dump` or `gcloud sql export sql`).
   - Run `uv run python scripts/verify_prod_cutover.py --mode pre --output Epics/1.0/prod_pre_cutover_snapshot.json` (read-only).
3. **Phase C — Git Promotion (`feat/epic-1.0-production-cutover` → `dev` → `main`)**:
   - Push branch, open PR into `dev`, pass `ci-gate.yml`, merge into `dev`, and verify `deploy-dev.yml` succeeds on `alpha-insight-web-dev`.
   - Open PR `dev` → `main`, pass `ci-gate.yml`, merge into `main`.
4. **Phase D — Gated Production Deployment & Migration**:
   - Approve the `production` GitHub Environment gate in `deploy-prod.yml`.
   - Pipeline executes `uv run alembic upgrade head` (`0001` → `0009`) against `4leafclover`, builds and pushes the web image, deploys `alpha-insight-web-prod`, and verifies HTTP 200 on `/api/health`.
5. **Phase E — Post-Cutover Verification & OAuth Registration**:
   - Run `uv run python scripts/verify_prod_cutover.py --mode post --baseline Epics/1.0/prod_pre_cutover_snapshot.json` (read-only) to confirm zero data loss and `alembic_version = '0009'`.
   - Register the provisioned `alpha-insight-web-prod` Cloud Run URL in Google OAuth Authorized JavaScript Origins.
   - Verify live UI on `alpha-insight-web-prod` and parallel operation of legacy `alphainsight` and `fourleafclover-dataops`.

---

## 3. Skill Allocation

| Skill | Responsibility |
| :--- | :--- |
| `logic-generator` (Single-Thread Mode) / `swarm-dispatcher`, `backend-worker`, `test-worker`, `swarm-integrator` (Swarm Mode) | Author schema validators, repository normalization refactor, `deploy-prod.yml` updates, read-only cutover verification script, cutover runbook, and unit tests. |
| `deterministic-resolver` | Execute Fast Targeted Gate during inner loop and Full 3-Tier CI-Parity Gate across workspace root `.` before push/PR and final handoff. |
| `spec-orchestrator` | Audit deliverables against [`Epics/1.0/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/PRD.md), check DRY/hardcoding compliance, verify CI-Parity Gate exit code `0`, and compile `Epics/1.0/WALKTHROUGH.md`. |

---

## 4. Engineering Standards & Verification

- **No Hardcoding**: All DB connection parameters, project IDs, and secrets come from environment variables / Secret Manager (no credentials or magic strings embedded in code or scripts).
- **DRY Compliance**: Capital `accounttype`/`transtype` normalization lives in one shared validator/helper module used by both Pydantic schemas and repository functions.
- **Type Safety & Documentation**: Strict Python type annotations (`from __future__ import annotations`), docstrings on all new functions/classes, inline comments explaining PROD legacy constraint alignment.
- **Command Execution Standard**: All Python invocations strictly via `uv run` (`uv run pytest`, `uv run ruff check .`, `uv run mypy ...`, `uv run python ...`); zero shell wrappers.
- **Database Safety Invariant**: Local automated tests run exclusively against isolated in-memory SQLite / test fixtures (`tests/conftest.py`); `scripts/verify_prod_cutover.py` enforces PostgreSQL `readonly=True` session mode so it can never mutate `4leafclover`.
- **Full CI-Parity Gate**: Mandatory consecutive zero exit codes across Tier 1 (Ruff check & format), Tier 2 (Mypy), and Tier 3 (full Pytest + Vitest + TypeScript check) before pushing or concluding Epic 1.0.
