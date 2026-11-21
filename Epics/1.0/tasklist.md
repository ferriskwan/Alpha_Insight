# Tasklist — Epic 1.0: Production Cutover (`Alpha_Insight` → `4leafclover`)

**Branch**: `feat/epic-1.0-production-cutover`  
**Implementation Plan**: [`Epics/1.0/IMPLEMENTATION_PLAN.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/IMPLEMENTATION_PLAN.md)  
**PRD**: [`Epics/1.0/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/PRD.md)  
**Execution Mode**: Single-Engineering Thread Mode (`[1]`)

---

## Phase A: Code, Workflow & Runbook Preparation

- [x] **T1. Update `.github/workflows/deploy-prod.yml`**
  - Renamed Cloud Run deploy and health probe target from `alpha-insight-web` to `alpha-insight-web-prod`.
  - Removed `Build & Push Daily Job Container (PROD)` and `Deploy Cloud Run Job (alpha-insight-daily-job)` steps so legacy `4leafclover` remains the sole PROD daily batch writer.
- [x] **T2. Implement PROD schema compatibility validators and DRY capital normalization**
  - Added shared helpers `normalize_capital_accounttype`, `normalize_capital_transtype`, and `normalize_trade_buysell` plus named PROD legacy column max-length constants in `backend/schemas/transactions.py`.
  - Reused shared `MAX_*` constants in `backend/schemas/ref_data.py` (`SysValueUpdate`) and `backend/api/v1/watchlist.py` (`WatchlistAddRequest`) — zero magic numbers.
  - Refactored `create_capital` and `update_capital` in `backend/repositories/portfolio_repo.py` to reuse the shared helpers (`'Leverage'`/`'L'` → `'M'`, `transtype` ∈ `{'D', 'F', 'W'}`).
- [x] **T3. Create read-only PROD cutover verification script (`scripts/verify_prod_cutover.py`)**
  - Enforces PostgreSQL `readonly=True` session mode and loads connection parameters strictly from environment variables.
  - Verified live read-only dry run against PROD `4leafclover`: `16 tables, alembic_version=None` (exit 0).
- [x] **T4. Create production cutover runbook (`Epics/1.0/CUTOVER_RUNBOOK.md`)**
  - Documented one-time `4leafclover` backup commands (`gcloud sql export sql` / `pg_dump`), read-only pre/post verification, PR promotion (`feat/epic-1.0-production-cutover` → `dev` → `main`), `production` gate approval, Google OAuth Authorized JavaScript Origin update, parallel legacy coexistence validation, and rollback procedure.
- [x] **T5. Author deterministic unit & contract tests (`tests/backend/test_prod_compatibility.py`)**
  - Added 25 unit/API/contract tests covering capital normalization, PROD length validation (HTTP 422), `deploy-prod.yml` structure, and `verify_prod_cutover.py` comparison logic.
- [x] **T6. Execute Full 3-Tier CI-Parity Gate (Workspace Root `.`)**
  - Tier 1 (`uv run ruff check .` & `uv run ruff format --check .`): exit 0 (`134 files already formatted`).
  - Tier 2 (`uv run mypy backend tests/backend` & `npx tsc --noEmit`): exit 0 (`65 source files`).
  - Tier 3 (`uv run pytest` & `npm test -- --run`): exit 0 (`117 passed` backend, `15 files / 86 passed` frontend).
- [x] **T7. Audit Phase (`spec-orchestrator`) & Walkthrough Generation (`Epics/1.0/WALKTHROUGH.md`)**
  - Completed DRY, hardcoding, and CI-Parity audit; compiled [`Epics/1.0/WALKTHROUGH.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/WALKTHROUGH.md).
  - Ready for user sign-off before committing/pushing `feat/epic-1.0-production-cutover` and executing Phases B–E cutover.
