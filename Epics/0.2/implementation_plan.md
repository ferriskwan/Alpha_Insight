# Implementation Plan — Epic 0.2
**Project**: Alpha_Insight  
**Epic**: 0.2 — Foundational Database Objects, Dynamic Sitemap Admin, Google OAuth2 RBAC, 100% API Infrastructure & Paper-Based Design System  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Document Path**: `C:\Users\ferri\devt\Alpha_Insight\Epics\0.2\implementation_plan.md`

---

## 1. Technical Scope & Affected Files

```
Alpha_Insight/
├── backend/
│   ├── alembic/versions/0003_foundational_admin_and_sitemap.py  [CREATE] Migration DDL
│   ├── db/models.py                                             [MODIFY] Add SiteMap, AuditLog, TransCost, RefChartSettings
│   ├── schemas/
│   │   ├── sitemap.py                                           [CREATE] Pydantic models for site map tree
│   │   ├── audit.py                                             [CREATE] Pydantic models for audit logs
│   │   ├── ref_data.py                                          [CREATE] Pydantic models for reference tables
│   │   └── transactions.py                                      [MODIFY] Add TransCost Pydantic schemas
│   ├── repositories/
│   │   ├── sitemap_repo.py                                      [CREATE] Hierarchical tree & role filter queries
│   │   ├── audit_repo.py                                        [CREATE] Audit event creation & query
│   │   ├── ref_data_repo.py                                     [CREATE] Dynamic table inspection & editing
│   │   └── portfolio_repo.py                                    [MODIFY] TransCost CRUD operations
│   ├── api/v1/
│   │   ├── sitemap.py                                           [CREATE] GET /api/v1/sitemap (role-filtered)
│   │   ├── admin.py                                             [MODIFY] Full CRUD for sitemap, ref-data, audit-logs
│   │   ├── transactions.py                                      [MODIFY] Add /api/v1/transactions/trans-cost
│   │   └── auth.py                                              [MODIFY] Enforce RBAC dependencies
│   └── main.py                                                  [MODIFY] Register new router endpoints
├── frontend/
│   ├── src/
│   │   ├── design-system/
│   │   │   ├── tokens.ts                                        [MODIFY] Aptos font & paper palette tokens
│   │   │   └── components/                                      [MODIFY] White paper styling across all components
│   │   ├── types/api.ts                                         [MODIFY] Add SiteMap, AuditLog, RefData types
│   │   ├── services/apiClient.ts                                [MODIFY] Add sitemap, ref-data, audit-log methods
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx                                 [CREATE] White paper header & layout frame
│   │   │   │   └── DynamicSidebar.tsx                           [CREATE] 100% DB-driven tree navigation
│   │   │   ├── admin/
│   │   │   │   ├── UserAdmin.tsx                                [CREATE] Clean paper user management UI
│   │   │   │   ├── SiteMapAdmin.tsx                             [CREATE] Navigation node tree editor
│   │   │   │   ├── RefDataEditor.tsx                            [CREATE] Reference table data editor
│   │   │   │   └── AuditLogsViewer.tsx                          [CREATE] Filterable audit log stream with JSON diff
│   │   │   └── placeholders/                                    [CREATE] Clean paper scaffolds for future epics
│   │   └── App.tsx                                              [MODIFY] Mount AppShell & dynamic router
│   ├── tailwind.config.js                                       [MODIFY] Set Aptos font family as default
│   └── src/index.css                                            [MODIFY] Paper background & Aptos font rules
└── docs/
    ├── architecture.md                                          [CREATE] Vitalis-aligned system architecture spec
    ├── openapi.json                                             [CREATE] Exported OpenAPI 3.1 specification
    └── .agents/contracts/                                       [CREATE] Formal DDL and TypeScript contracts
```

---

## 2. Skill Allocation & Responsibilities

| Skill / Role | Primary Responsibilities in Epic 0.2 |
| :--- | :--- |
| **`spec-orchestrator`** | Baselines formal contracts in `.agents/contracts/`, verifies architecture adherence, ensures anti-fluff compliance, and authors `docs/architecture.md`. |
| **`backend-worker`** | Authors Alembic migration `0003`, SQLAlchemy models, repositories (`sitemap_repo`, `audit_repo`, `ref_data_repo`), FastAPI endpoints, and RBAC middleware. |
| **`frontend-worker`** | Implements the Aptos white paper design system (`tokens.ts`), `AppShell.tsx`, `DynamicSidebar.tsx`, and the 4 Admin sub-application interfaces (`UserAdmin`, `SiteMapAdmin`, `RefDataEditor`, `AuditLogsViewer`). |
| **`test-worker`** | Authors comprehensive automated tests: Pytest for backend endpoints/RBAC/migrations, Vitest for frontend dynamic sitemap rendering and Aptos design token compliance. |
| **`deterministic-resolver`** | Drives the verification loop: executes linters (`ruff check`), typecheckers (`tsc`), and test suites with terminal stderr/stdout analysis. |

---

## 3. Engineering Phases & Step-by-Step Milestones

### Phase 1: Database Foundation & Schema Baselining (Prerequisite Barrier)
1. **Alembic Migration `0003_foundational_admin_and_sitemap.py`**:
   - Create tables: `site_map`, `audit_log`, `trans_cost`, `ref_chart_settings`.
   - Seed default `site_map` nodes:
     - `My Portfolio` (`portfolio.overview`, `portfolio.trans_investment`, `portfolio.trans_capital`, `portfolio.trans_cost`, `portfolio.watchlist`)
     - `Research` (`research.stock_analyst`, `research.macro`, `research.industry`)
     - `Investment Notes` (`notes.index`)
     - `Admin` (`admin.users`, `admin.sitemap`, `admin.ref_data`, `admin.audit_logs`)
   - Seed default `ref_chart_settings` row with institutional defaults (SMA 30, EMA 100, BB 30/2, RSI 13, MACD 12/26/9).
2. **Apply Migration to `4leafclover_dev`**:
   - Execute `uv run alembic upgrade head`.
   - Verify table creation and seed data integrity.
3. **Export Machine-Readable DDL Contract**:
   - Store exact schema definition in `.agents/contracts/database_schema.sql`.

### Phase 2: Backend API Infrastructure & RBAC
1. **SQLAlchemy Models**:
   - Define `SiteMap`, `AuditLog`, `TransCost`, `RefChartSettings` in `backend/db/models.py`.
2. **Repositories**:
   - `sitemap_repo.py`: Hierarchical recursive tree generation, role entitlement filtering.
   - `audit_repo.py`: Helper `log_audit_event(db, user_id, action, entity, entity_id, old_val, new_val)`.
   - `ref_data_repo.py`: Generic introspector for `sysvalue` and `ref_chart_settings` records.
   - `portfolio_repo.py`: `get_trans_costs`, `create_trans_cost`, `delete_trans_cost`.
3. **API Endpoints**:
   - `GET /api/v1/sitemap`: Returns JSON tree tailored to caller's role.
   - `GET, POST, PUT, DELETE /api/v1/admin/sitemap`: Admin sitemap node management.
   - `GET, PUT /api/v1/admin/ref-data/{table}`: Reference data table inspector and record editor.
   - `GET /api/v1/admin/audit-logs`: Audit logs query endpoint with filtering.
   - `GET, POST, DELETE /api/v1/transactions/trans-cost`: Transaction cost ledger endpoints.
4. **FastAPI Route Mounting & OpenAPI Export**:
   - Mount new routers in `backend/main.py`.
   - Export generated schema to `docs/openapi.json`.

### Phase 3: Frontend White Paper Design System & Rebuild
1. **Aptos Typography & Paper Tokens**:
   - Configure `@font-face` / fallback stack in `tailwind.config.js` and `index.css`: `'Aptos', 'Segoe UI', -apple-system, sans-serif`.
   - Update `frontend/src/design-system/tokens.ts` with `paper` tokens and high-contrast chart palettes.
   - Adapt `Button`, `Input`, `Select`, `Badge`, `ResponsiveTable`, and `Modal` to clean paper aesthetics (`#FFFFFF` surfaces, `#E2E8F0` thin hair-lines, `#0F172A` deep ink).
2. **Application Frame (`AppShell.tsx`)**:
   - White top panel (`h-14`, `#FFFFFF`, border-b `#E2E8F0`).
   - AlphaInsight logo, environment badge, user avatar, and role pill.
3. **100% Dynamic Navigation (`DynamicSidebar.tsx`)**:
   - Consumes `apiClient.getSiteMap()`.
   - Renders nested tree navigation with smooth chevron expansion and clean active indicators.
4. **Admin Sub-Applications Suite**:
   - `UserAdmin.tsx`: Clean data table listing users, roles, email, active status toggles, and role demote/promote actions.
   - `SiteMapAdmin.tsx`: Two-column tree navigator and node editor form.
   - `RefDataEditor.tsx`: Table selector (`sysvalue`, `ref_chart_settings`, `exchange_rate`) and value editor.
   - `AuditLogsViewer.tsx`: Filterable audit event table with expandable JSON diff viewer.
5. **Scaffold Placeholders**:
   - Clean paper placeholders for `Macroeconomics`, `By Industry/Sector`, and `Investment Notes` indicating readiness for upcoming epics.

### Phase 4: Machine-Readable Documentation Architecture
1. **`docs/architecture.md`**: Detailed system architecture conforming to Vitalis standards (monolith layout, database layers, API conventions, and Swarm team integration guidelines).
2. **`.agents/contracts/`**: Formal TypeScript API contracts (`api_contracts.ts`) and SQL DDL (`database_schema.sql`).
3. **`docs/design_system.md`**: Token reference documenting Aptos typography, line weights, and paper color hex values.

### Phase 5: Verification & Quality Gate
1. **Tier 1 (Lint & Format)**: `uv run ruff check backend` and scoped prettier/eslint.
2. **Tier 2 (Static Types)**: `npx.cmd tsc --noEmit` and `uv run mypy backend`.
3. **Tier 3 (Automated Tests)**:
   - Pytest test suite covering sitemap filtering, RBAC protection, audit log generation, and transaction cost CRUD.
   - Vitest test suite covering dynamic sitemap rendering, Aptos typography token assertion, and admin UI interactions.

---

## 4. Engineering Standards & Anti-Fluff Verification

- **Anti-Fluff Standard**: Zero marketing adjectives. Features documented strictly as functional objects, endpoints, and columns.
- **Direct Command Execution**: All commands executed directly with `uv run` and `npm.cmd` / `npx.cmd`. Zero `cmd /c` outer wrappers.
- **Database Safety**: Tests and development run strictly against `4leafclover_dev`. Production databases remain untouched.
- **Dry & Decoupled**: 100% of data flow runs through `/api/v1/` endpoints.
