# Walkthrough — Epic 1.0: Production Cutover Preparation (`Alpha_Insight` → `4leafclover`)

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.0 (Phase A Complete — Ready for Cutover Execution Phases B–E)  
**Branch**: `feat/epic-1.0-production-cutover`  
**PRD**: [`Epics/1.0/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/PRD.md)  
**Implementation Plan**: [`Epics/1.0/IMPLEMENTATION_PLAN.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/IMPLEMENTATION_PLAN.md)

---

## 1. PRD Requirement-to-Code Traceability Matrix

| PRD Requirement / SC | Delivered Artifact & File Link | Status |
| :--- | :--- | :--- |
| **4.1 / SC-3: `capital` `'Leverage'`/`'L'` → `'M'` & `transtype` validation** | [`backend/schemas/transactions.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/transactions.py#L24-L53) (`normalize_capital_accounttype`, `normalize_capital_transtype`, `normalize_trade_buysell`) and [`backend/repositories/portfolio_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L79-L86) (`create_capital`, `update_capital`). | **VERIFIED** |
| **4.1 / SC-3: Untouched PROD legacy column length guards** | Named `MAX_*` constants and Pydantic `Field(max_length=...)` constraints across [`backend/schemas/transactions.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/transactions.py#L10-L120), [`backend/schemas/ref_data.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/ref_data.py#L31-L39), and [`backend/api/v1/watchlist.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/watchlist.py#L39-L43). | **VERIFIED** |
| **4.1 / SC-5: Cloud Run `alpha-insight-web-prod` only (no PROD daily job)** | [`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml#L100-L139): deploys `alpha-insight-web-prod`, probes `alpha-insight-web-prod/api/health`, and removes `alpha-insight-daily-job` build/deploy steps. | **VERIFIED** |
| **4.2 / SC-1 & SC-4: Zero-data-loss pre/post DB verifier** | [`scripts/verify_prod_cutover.py`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/verify_prod_cutover.py): enforces PostgreSQL `readonly=True`, snapshots all tables/row counts (`--mode pre`), and verifies `alembic_version == '0009'`, 28 tables, and non-decreasing legacy row counts (`--mode post`). Verified read-only against live `4leafclover` (`16 tables, alembic_version=None`). | **VERIFIED** |
| **4.2, 4.4–4.6 / SC-1, SC-6, SC-7: Cutover & Rollback Runbook** | [`Epics/1.0/CUTOVER_RUNBOOK.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/CUTOVER_RUNBOOK.md): one-time `pg_dump` / GCS export, pre/post verification, PR promotion (`dev` → `main`), `production` gate approval, Google OAuth Authorized JavaScript Origin update, legacy coexistence validation, and rollback steps. | **VERIFIED** |
| **4.1 / SC-2 & SC-3: Deterministic unit & contract tests** | [`tests/backend/test_prod_compatibility.py`](file:///c:/Users/ferri/devt/Alpha_Insight/tests/backend/test_prod_compatibility.py): 25 tests covering capital normalization, HTTP 422 length rejections, `deploy-prod.yml` contract, and snapshot diff logic. | **VERIFIED** |

---

## 2. Full 3-Tier CI-Parity Gate Results (Workspace Root `.`)

| Tier | Command | Result | Exit Code |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Lint)** | `uv run ruff check .` | `All checks passed!` | `0` |
| **Tier 1 (Format)** | `uv run ruff format --check .` | `134 files already formatted` | `0` |
| **Tier 2 (Python Types)** | `uv run mypy backend tests/backend` | `Success: no issues found in 65 source files` | `0` |
| **Tier 2 (Frontend Types)** | `npx tsc --noEmit` (in `frontend/`) | 0 errors | `0` |
| **Tier 3 (Backend Tests)** | `uv run pytest` | `117 passed, 1 warning` | `0` |
| **Tier 3 (Frontend Tests)** | `npm test -- --run` (in `frontend/`) | `15 test files passed, 86 tests passed` | `0` |

---

## 3. `spec-orchestrator` Audit Findings

- **CI-Parity Audit**: Passed — all 3 tiers exited `0` consecutively across the full workspace root `.`.
- **Hardcoding & Anti-Pattern Audit**: Passed — all PROD column width limits are defined as named constants in [`backend/schemas/transactions.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/transactions.py) and imported into [`backend/schemas/ref_data.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/ref_data.py) and [`backend/api/v1/watchlist.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/watchlist.py). [`scripts/verify_prod_cutover.py`](file:///c:/Users/ferri/devt/Alpha_Insight/scripts/verify_prod_cutover.py) reads credentials exclusively from environment variables.
- **Architecture & DRY Audit**: Passed — duplicated `accounttype`/`transtype` normalization logic in `create_capital` and `update_capital` was consolidated into shared helpers.
- **Pending Live Cutover Steps (Phases B–E — Require User Sign-Off)**:
  1. Commit and push `feat/epic-1.0-production-cutover` to GitHub (held pending your explicit sign-off).
  2. Execute one-time `4leafclover` backup and capture `Epics/1.0/prod_pre_cutover_snapshot.json` per [`Epics/1.0/CUTOVER_RUNBOOK.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/CUTOVER_RUNBOOK.md).
  3. Merge PR `feat/epic-1.0-production-cutover` → `dev` (verify `deploy-dev.yml`), then merge PR `dev` → `main` and approve the `production` GitHub Environment gate.
  4. Run `scripts/verify_prod_cutover.py --mode post`, add the `alpha-insight-web-prod` URL to Google OAuth Authorized JavaScript Origins, and verify live UI + legacy coexistence.

**Audit Verdict**: **`[UAT PASSED — PHASE A READY FOR CUTOVER]`**
