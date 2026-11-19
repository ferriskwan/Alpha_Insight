# Tasklist & Swarm Execution Plan — Epic 0.2

**Epic**: 0.2 — Foundational Database Objects, Dynamic Sitemap Admin, Google OAuth2 RBAC, 100% API Infrastructure & Paper-Based Design System  
**Execution Mode**: Swarm Mode (`[2]`)  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**File Location**: `C:\Users\ferri\devt\Alpha_Insight\tasklist.md`

---

## 1. File Ownership Matrix (Strict Collision Invariant)

| File / Directory | Designated Stream Owner | Phase | Collision Safeguard Rule |
| :--- | :--- | :--- | :--- |
| `alembic/versions/0003_foundational_admin_and_sitemap.py` | `swarm-dispatcher` | Phase 1 | Dispatcher exclusive |
| `backend/db/models.py` | `swarm-dispatcher` | Phase 1 | Dispatcher exclusive |
| `.agents/contracts/*` | `swarm-dispatcher` | Phase 1 | Dispatcher exclusive |
| `tasklist.md` | `swarm-dispatcher` / `swarm-integrator` | All | Worker writes forbidden |
| `backend/schemas/sitemap.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/schemas/audit.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/schemas/ref_data.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/schemas/transactions.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/repositories/sitemap_repo.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/repositories/audit_repo.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/repositories/ref_data_repo.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/repositories/portfolio_repo.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/api/v1/sitemap.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/api/v1/admin.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/api/v1/transactions.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/api/v1/auth.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `backend/main.py` | `[STREAM: BE]` | Phase 2 | BE worker exclusive |
| `.agents/tasks/stream_be.md` | `[STREAM: BE]` | Phase 2 | BE progress log exclusive |
| `frontend/src/design-system/tokens.ts` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/tailwind.config.js` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/index.css` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/types/api.ts` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/services/apiClient.ts` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/layout/AppShell.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/layout/DynamicSidebar.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/admin/UserAdmin.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/admin/SiteMapAdmin.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/admin/RefDataEditor.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/admin/AuditLogsViewer.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/components/placeholders/ScaffoldViews.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `frontend/src/App.tsx` | `[STREAM: FE]` | Phase 2 | FE worker exclusive |
| `.agents/tasks/stream_fe.md` | `[STREAM: FE]` | Phase 2 | FE progress log exclusive |
| `tests/backend/test_sitemap_rbac.py` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `tests/backend/test_audit_logging.py` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `tests/backend/test_admin_ref_data.py` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `tests/backend/test_trans_cost.py` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `tests/frontend/sitemap_rendering.test.tsx` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `tests/frontend/design_system_paper.test.tsx` | `[STREAM: QA]` | Phase 2 | QA worker exclusive |
| `.agents/tasks/stream_qa.md` | `[STREAM: QA]` | Phase 2 | QA progress log exclusive |
| `docs/architecture.md` | `swarm-integrator` | Phase 3 | Integrator exclusive |
| `docs/openapi.json` | `swarm-integrator` | Phase 3 | Integrator exclusive |
| `docs/design_system.md` | `swarm-integrator` | Phase 3 | Integrator exclusive |

---

## 2. DAG Decomposition & Execution Milestones

### Phase 1: Prerequisite Barrier (Contract & Schema Baselining)
- [ ] Milestone 1.1: Author Alembic migration `0003_foundational_admin_and_sitemap.py` creating `site_map`, `audit_log`, `trans_cost`, `ref_chart_settings`.
- [ ] Milestone 1.2: Define SQLAlchemy 2.0 models `SiteMap`, `AuditLog`, `TransCost`, `RefChartSettings` in `backend/db/models.py`.
- [ ] Milestone 1.3: Apply migration to `4leafclover_dev` (`uv run alembic upgrade head`) and verify table creation with exit code 0.
- [ ] Milestone 1.4: Baseline frozen contracts in `.agents/contracts/database_schema.sql` and `.agents/contracts/api_contracts.ts`.
- [ ] Milestone 1.5: Prerequisite Verification Gate (Ruff check & schema integrity exit code 0).

### Phase 2: Parallel Stream Barrier (Concurrent Worker Dispatch)
- [ ] **`[STREAM: BE]` Backend Worker**:
  - [ ] Implement `sitemap_repo.py`, `audit_repo.py`, `ref_data_repo.py`, and `trans_cost` in `portfolio_repo.py`.
  - [ ] Implement REST endpoints: `GET /api/v1/sitemap`, `/api/v1/admin/sitemap`, `/api/v1/admin/ref-data`, `/api/v1/admin/audit-logs`, `/api/v1/transactions/trans-cost`.
  - [ ] Enforce RBAC dependencies and audit logging on data mutations.
  - [ ] Signal `[STATUS: READY]` in `.agents/tasks/stream_be.md`.
- [ ] **`[STREAM: FE]` Frontend Worker**:
  - [ ] Configure Aptos font family and paper aesthetic tokens in `tokens.ts`, `tailwind.config.js`, `index.css`.
  - [ ] Update `types/api.ts` and `apiClient.ts` with sitemap, ref data, audit log methods.
  - [ ] Build `AppShell.tsx` and `DynamicSidebar.tsx` (100% DB-driven from `/api/v1/sitemap`).
  - [ ] Build Admin sub-applications: `UserAdmin.tsx`, `SiteMapAdmin.tsx`, `RefDataEditor.tsx`, `AuditLogsViewer.tsx`.
  - [ ] Signal `[STATUS: READY]` in `.agents/tasks/stream_fe.md`.
- [ ] **`[STREAM: QA]` QA Worker**:
  - [ ] Author backend unit tests: `test_sitemap_rbac.py`, `test_audit_logging.py`, `test_admin_ref_data.py`, `test_trans_cost.py`.
  - [ ] Author frontend Vitest tests: `sitemap_rendering.test.tsx`, `design_system_paper.test.tsx`.
  - [ ] Validate fast targeted gate execution on test files.
  - [ ] Signal `[STATUS: READY]` in `.agents/tasks/stream_qa.md`.

### Phase 3: Integration Handoff & Convergence Pass
- [ ] Milestone 3.1: Reconcile federated stream logs (`stream_be.md`, `stream_fe.md`, `stream_qa.md`).
- [ ] Milestone 3.2: Export OpenAPI spec to `docs/openapi.json` and generate `docs/architecture.md`.
- [ ] Milestone 3.3: Execute Full CI-Parity Gate (Tier 1: Ruff check; Tier 2: TypeScript & Mypy; Tier 3: Pytest & Vitest).
- [ ] Milestone 3.4: Generate `walkthrough.md` for user final acceptance.
