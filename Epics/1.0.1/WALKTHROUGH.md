# Epic 1.0.1 — Walkthrough & Audit Report

**Branch:** `1.0.1`  
**PRD:** [PRD.md](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0.1/PRD.md)  
**Implementation Plan:** [IMPLEMENTATION_PLAN.md](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.0.1/IMPLEMENTATION_PLAN.md)  
**Audit Status:** `[UAT PASSED]`

---

## 1. PRD-to-Code Requirement Mapping

| PRD Item | Requirement | Implemented Files |
|---|---|---|
| **Item 1** | Dynamic alphabetical currency sub-totals (`HKD`, `SGD`, `USD`, ...), remove BUY/SELL Price (`Avg —`), Quantity, and `Net Bal` from sub-totals and Grand Total, fix Grand Total historical FX consolidation across all currencies, and apply consistent currency prefixes (`HK$`, `S$`, `$`). | [currency.ts](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/lib/currency.ts), [TransactionsView.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx), [transactions.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/transactions.py), [portfolio.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/portfolio.py) |
| **Item 2** | Chart 1 & Chart 2 legend checkboxes (including all held symbols in Chart 2 without altering `Total`), BUY/SELL and Capital Deposit/Withdrawal markers + tooltip details + toggles, and 3-layer self-healing EOD `NaN`/zero-price dip fix. | [PortfolioOverview.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx), [api.ts](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/types/api.ts), [portfolio.py (schemas)](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/portfolio.py), [portfolio_repo.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py), [ProcessData.py](file:///c:/Users/ferri/devt/Alpha_Insight/ProcessData.py), [run_mark_to_market.py](file:///c:/Users/ferri/devt/Alpha_Insight/run_mark_to_market.py), [run_portfolio_summary.py](file:///c:/Users/ferri/devt/Alpha_Insight/run_portfolio_summary.py) |
| **Item 3** | Inject `API_URL` and `API_KEY` into `alpha-insight-daily-job-dev`, add `alpha-insight-daily-job-prod` to `deploy-prod.yml`, bound DB connection pools, and add Cloud Run `localhost` guard in `main.py`. | [deploy-dev.yml](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-dev.yml), [deploy-prod.yml](file:///c:/Users/ferri/devt/Alpha_Insight/.github/workflows/deploy-prod.yml), [config.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/config.py), [session.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/db/session.py), [main.py](file:///c:/Users/ferri/devt/Alpha_Insight/main.py) |
| **Item 4** | Backdated research run selector in `Macroeconomics` matching `Stock Analysis` via `AnalystOutputPanel`'s shared `TimelineRunNavigator`, plus clickable history ledger rows. | [MacroeconomicsView.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/MacroeconomicsView.tsx) |
| **Item 5** | Reconstruct and sort `Navigation Hierarchy Tree` in `Site Map Admin` by `parent_id` and `order_index` ascending to match the left sidebar order, and persist `parent_id` on node updates. | [SiteMapAdmin.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/admin/SiteMapAdmin.tsx), [api.ts](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/types/api.ts) |
| **Item 6** | 3-tier `<optgroup>` sorting on `Watchlist Symbol` dropdown in `Stock Analysis` (`My Positions`, `Other Stocks`, `Indexes`), ascending alphabetical by `symbol`. | [AnalystCommitteeView.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/AnalystCommitteeView.tsx) |
| **Item 7** | Add `gemini-4-neon` (`Gemini 4 Neon`) and remove all Gemini models `< 4` (`gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`). | [agent_orchestrator.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/services/agent_orchestrator.py) |

---

## 2. Full CI-Parity Gate Results

| Tier | Command | Result |
|---|---|---|
| Tier 1 (Lint) | `uv run ruff check .` | Exit `0` (`All checks passed!`) |
| Tier 1 (Format) | `uv run ruff format --check .` | Exit `0` (`141 files already formatted`) |
| Tier 2 (Python Types) | `uv run mypy backend` | Exit `0` (`Success: no issues found in 48 source files`) |
| Tier 2 (TypeScript) | `npx tsc --noEmit` | Exit `0` |
| Tier 3 (Backend Tests) | `uv run pytest` | Exit `0` (`123 passed`, including 6 new tests in [test_epic_1_0_1.py](file:///c:/Users/ferri/devt/Alpha_Insight/tests/backend/test_epic_1_0_1.py)) |
| Tier 3 (Frontend Tests) | `npx vitest run` | Exit `0` (`17 test files / 93 passed`, including 5 new tests in [epic_1_0_1.test.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/tests/frontend/epic_1_0_1.test.tsx) and `design_system_audit.test.tsx`) |

---

## 3. Audit Checks (`spec-orchestrator` & `ui-ux-designer`)
- **Hardcoding & Secret Audit**: Passed. Removed hardcoded `1.30` SGD FX fallback in `TransactionsView.tsx`; DB pool sizes externalized to `backend/config.py`; Cloud Run Job `API_URL` resolved dynamically via `gcloud run services describe` and `API_KEY` mounted from Secret Manager; zero rogue hex colors verified by `design_system_audit.test.tsx`.
- **DRY & Architecture Audit**: Passed. Shared currency prefix/inference extracted to [currency.ts](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/lib/currency.ts); `MacroeconomicsView.tsx` reuses `AnalystOutputPanel`'s existing `TimelineRunNavigator` rather than duplicating stepper UI.
- **Missing Items Declaration**: None. All 7 items in `Epics/1.0.1/PRD.md` are implemented and verified. Note that live Cloud Run Job execution (`alpha-insight-daily-job-dev` / `alpha-insight-daily-job-prod`) and PROD batch self-healing will take effect once branch `1.0.1` is committed, pushed, and deployed via `deploy-dev.yml` / `deploy-prod.yml`.
