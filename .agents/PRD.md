# Product Requirements Document (PRD) — Epic 1.0: Production Cutover (`Alpha_Insight` → `4leafclover`)

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.0  
**Branch**: `feat/epic-1.0-production-cutover` (branched from `dev`)  
**Status**: Ready for User Sign-off (`proceed`)  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]` (Production database migration `0001`–`0009`, Cloud Run `alpha-insight-web-prod` provisioning, CI/CD release promotion `dev` → `main`, and PROD legacy schema compatibility fixes)

> Canonical Epic PRD location: [`Epics/1.0/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0/PRD.md)

---

## 1. Objective

Promote `Alpha_Insight` from `dev` (`4leafclover_dev` / `alpha-insight-web-dev`) to production (`main` / `4leafclover` / `alpha-insight-web-prod`) with zero data loss and full backward compatibility with the legacy `4leafclover` services running in parallel.

---

## 2. Locked Scope Decisions

1. **Cloud Run Production Scope**: Deploy `alpha-insight-web-prod` only in [`.github/workflows/deploy-prod.yml`](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml). Exclude `alpha-insight-daily-job` so legacy `4leafclover` remains the sole daily batch writer in PROD.
2. **Pre-Cutover Compatibility Fixes**:
   - Rename production Cloud Run service in `deploy-prod.yml` to `alpha-insight-web-prod`.
   - Map `"LEVERAGE"` / `"L"` → `"M"` in `create_capital` / `update_capital` (`backend/repositories/portfolio_repo.py`) and validate `transtype` ∈ `{'D', 'F', 'W'}` to satisfy PROD `capital` CHECK constraints.
   - Add input length validation guards matching untouched narrow PROD legacy columns (`trade`, `watchlist`, `sysvalue`).
3. **Zero-Data-Loss Backup Strategy**: Take a one-time pre-cutover `pg_dump` or Cloud SQL GCS export of `4leafclover` prior to approving the `production` deployment gate (leave automated Cloud SQL backups disabled on `clover`).
4. **Legacy Coexistence & OAuth**: Keep legacy `alphainsight` and `fourleafclover-dataops` running in parallel during validation; register the provisioned `alpha-insight-web-prod` URL in Google OAuth Authorized JavaScript Origins.

---

## 3. Success Criteria Summary

- **SC-1**: Verified one-time backup of `4leafclover` and pre-migration row-count snapshot captured before migration.
- **SC-2**: Full 3-tier CI-Parity Gate passes (`ruff check`, `ruff format --check`, `mypy`, `pytest`, `vitest` = exit `0`).
- **SC-3**: PROD write compatibility verified (`capital` `'L'` → `'M'`, `transtype` check, narrow legacy column length guards).
- **SC-4**: `4leafclover` upgrades cleanly to Alembic `0009` (28 tables total: 16 legacy + 12 new) with zero row loss across all 16 legacy tables (`sysvalue` 3 → 4 rows).
- **SC-5**: Cloud Run service `alpha-insight-web-prod` is deployed (`Ready`), `GET /api/health` returns HTTP 200 `{"status":"ok","env":"PRD"}`, and no production daily job is provisioned.
- **SC-6**: Legacy `fourleafclover-dataops` and `alphainsight` remain operational against `4leafclover`.
- **SC-7**: Authenticated user on `alpha-insight-web-prod` loads live `4leafclover` Portfolio Overview (default `SGD`), Transactions, Watchlist, Stock Analysis, and Investment Notes with zero API or console errors.
