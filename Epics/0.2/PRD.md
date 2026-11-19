# Product Requirements Document (PRD) — Epic 0.2 (Revised)
**Project**: Alpha_Insight  
**Epic**: 0.2 — Foundational Database Objects, Dynamic Sitemap Admin, Google OAuth2 RBAC, 100% API Infrastructure & Paper-Based Design System  
**Database Instance**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Document Path**: `C:\Users\ferri\devt\Alpha_Insight\Epics\0.2\PRD.md`  
**Roadmap Alignment**:  
- **Epic 0.2 (Current)**: Foundational DB objects, Admin sub-apps, Dynamic Sitemap, RBAC, API infrastructure, White Paper UI rebuild, and machine-readable documentation.  
- **Epic 0.3 (Next)**: My Portfolio sub-applications (Overview 4-chart sync, Transactions, Watch List) and Research sub-applications (Stock Analyst, Macroeconomics, By Industry/Sector).  
- **Epic 0.4 (Subsequent)**: Investment Notes and Multi-Agent committee capabilities.

---

## 1. Current State & Revision Drivers

The Epic 0.1 implementation proved the viability of combining FastAPI, PostgreSQL (`4leafclover_dev`), and React. However, three foundational shortcomings require this revised Epic 0.2 foundation before proceeding with high-level analytics in Epic 0.3:
1. **Hardcoded UI Navigation**: The sidebar menu is static in TypeScript code. In production, navigation, route entitlements, and menu hierarchy must be 100% dynamically driven from database tables.
2. **Missing Admin Infrastructure**: Admin capabilities (User directory, Site Map management, Reference Data editing, and Audit logging) lack underlying database tables, schemas, and UIs.
3. **Dark Bento UI Aesthetic Pivot**: The initial dark bento interface must be replaced with a **clean, white paper-based design system** featuring sharp lines and high-contrast chart colors to emulate a printed institutional investment report.

---

## 2. Foundational Database Objects (`4leafclover_dev`)

All database schema additions will be applied via Alembic migration (`0003_foundational_admin_and_sitemap`).

### 2.1 Admin Sub-Applications Tables
1. **`users`** (Baseline exists, verify/extend):
   - `id`: Serial primary key
   - `email`: Varchar(255) unique, indexed
   - `name`: Varchar(255)
   - `picture`: Varchar(512), nullable
   - `google_id`: Varchar(255) unique, nullable
   - `status`: Varchar(32) default `'active'` (`active`, `expired`, `suspended`)
   - `created_at`: Timestamp with time zone default `now()`
   - `updated_at`: Timestamp with time zone default `now()`
2. **`user_roles`** (Baseline exists, verify/extend):
   - `id`: Serial primary key
   - `user_id`: Integer foreign key -> `users.id` on delete cascade
   - `role`: Varchar(64) (`admin`, `analyst`, `user`)
   - `status`: Varchar(32) default `'active'`
   - `created_at`: Timestamp with time zone default `now()`
3. **`site_map`** (New table for 100% dynamic navigation):
   - `id`: Serial primary key
   - `parent_id`: Integer foreign key -> `site_map.id` on delete cascade, nullable (null = root category)
   - `menu_code`: Varchar(64) unique (e.g., `'portfolio.overview'`, `'admin.users'`)
   - `label`: Varchar(128) (e.g., `'Overview'`, `'User Admin'`)
   - `route`: Varchar(255) (e.g., `'/portfolio/overview'`, `'/admin/users'`)
   - `icon`: Varchar(64), nullable (Lucide icon identifier)
   - `role_required`: Varchar(64) default `'user'` (`user`, `analyst`, `admin`)
   - `order_index`: Integer default `0`
   - `is_active`: Boolean default `true`
   - `created_at`: Timestamp with time zone default `now()`
4. **`audit_log`** (New table for system security & data audit trail):
   - `id`: Bigserial primary key
   - `user_id`: Integer foreign key -> `users.id`, nullable (system events)
   - `action`: Varchar(64) (e.g., `'LOGIN'`, `'UPDATE_ROLE'`, `'EDIT_REF_DATA'`, `'DELETE_RECORD'`)
   - `entity`: Varchar(64) (e.g., `'users'`, `'site_map'`, `'sysvalue'`, `'trade'`)
   - `entity_id`: Varchar(64), nullable
   - `old_values`: JSONB, nullable
   - `new_values`: JSONB, nullable
   - `ip_address`: Varchar(45), nullable
   - `user_agent`: Varchar(512), nullable
   - `timestamp`: Timestamp with time zone default `now()`, indexed
5. **Reference Data Tables (`sysvalue` & `ref_chart_settings`)**:
   - `sysvalue`: Key-value configuration (`name`, `type`, `strvalue`, `numvalue`, `datevalue`, `description`).
   - `ref_chart_settings`: Technical indicator baseline parameters (`sma_period`, `ema_period`, `bb_period`, `bb_std`, `rsi_period`, `rsi_ob`, `rsi_os`, `macd_fast`, `macd_slow`, `macd_signal`).

### 2.1 Portfolio Foundational Tables
1. **`trades`** (Investment transactions):
   - `id`: Serial primary key
   - `user_id`: Integer foreign key -> `users.id`
   - `symbol`: Varchar(32) indexed
   - `buysell`: Varchar(4) (`B` = Buy, `S` = Sell)
   - `tradedate`: Timestamp without time zone indexed
   - `investment`: Boolean default `true` (True = Cash Ledger, False = Margin Ledger)
   - `price`: Numeric(12, 4)
   - `quantity`: Numeric(14, 4)
   - `remarks`: Text, nullable
2. **`capital`** (Capital transactions):
   - `id`: Serial primary key
   - `user_id`: Integer foreign key -> `users.id`
   - `broker`: Varchar(64)
   - `transtype`: Varchar(4) (`D` = Deposit, `W` = Withdrawal, `I` = Initial)
   - `accounttype`: Varchar(16) (`Cash`, `Margin`, `C`, `M`)
   - `amount`: Numeric(14, 2)
   - `date`: Date indexed
   - `currency`: Varchar(8) default `'USD'`
   - `remarks`: Text, nullable
3. **`trans_cost`** (New table for transaction & carrying costs):
   - `id`: Serial primary key
   - `user_id`: Integer foreign key -> `users.id`
   - `trade_id`: Integer foreign key -> `trades.id`, nullable
   - `cost_type`: Varchar(32) (`COMMISSION`, `EXCHANGE_FEE`, `STAMP_DUTY`, `MARGIN_INTEREST`, `OTHER`)
   - `amount`: Numeric(12, 4)
   - `currency`: Varchar(8) default `'USD'`
   - `date`: Date indexed
   - `remarks`: Text, nullable
4. **`watchlist`** (Watch List symbols):
   - `id`: Serial primary key
   - `user_id`: Integer foreign key -> `users.id`
   - `watchlistname`: Varchar(64) default `'Default'`
   - `symbol`: Varchar(32) indexed
   - `name`: Varchar(255), nullable
   - `timezone`: Varchar(64) default `'America/New_York'`
   - `currency`: Varchar(8) default `'USD'`
   - `sort_order`: Integer default `0`

---

## 3. Authentication & Role-Based Access Control (RBAC)

1. **Authentication via Google OAuth2.0**:
   - Frontend triggers Google Identity Services (GSI) prompt.
   - Frontend sends JWT credential token to `POST /api/v1/auth/google-login`.
   - Backend validates Google JWT signature, issuer, and audience using `google-auth` library.
   - Auto-provisions new user record if not present, assigning default role `'user'`.
   - Issues cryptographically random session token persisted in `user_sessions` and returned as an `HttpOnly`, `SameSite=Lax` cookie (`alpha_sid`).
2. **Role-Based Entitlement**:
   - Roles hierarchy:
     - `admin`: Full access to Admin sub-applications, system configuration, all user profiles, and audit logs.
     - `analyst`: Access to Research, Stock Analyst, and Portfolio analytics.
     - `user`: Standard access to My Portfolio, personal transactions, and personal watchlist.
   - FastAPI dependencies: `get_current_user`, `require_role(role: str)`.
   - Dynamic Sitemap filtering: API endpoint `/api/v1/sitemap` returns only the navigation nodes that the authenticated user is entitled to view based on their assigned roles.

---

## 4. API Infrastructure (100% Decoupled REST Communication)

Zero direct database calls from frontend. 100% of data access and mutation is executed through strongly-typed FastAPI endpoints with Pydantic v2 schemas:

| Endpoint Path | Method | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/google-login` | POST | Public | Authenticates Google credential token & creates session |
| `/api/v1/auth/me` | GET | Authenticated | Returns current user profile and active roles |
| `/api/v1/auth/logout` | POST | Authenticated | Invalidates session and clears `alpha_sid` cookie |
| `/api/v1/sitemap` | GET | Authenticated | Returns dynamic navigation tree filtered by user roles |
| `/api/v1/admin/sitemap` | GET, POST, PUT, DELETE | Admin Only | Full CRUD over navigation menu items |
| `/api/v1/admin/users` | GET | Admin Only | Lists user directory with roles and statuses |
| `/api/v1/admin/users/roles` | POST | Admin Only | Grants or revokes user roles |
| `/api/v1/admin/users/status` | POST | Admin Only | Activates or expires user account |
| `/api/v1/admin/ref-data/tables` | GET | Admin Only | Lists editable reference data tables |
| `/api/v1/admin/ref-data/{table}` | GET, PUT, POST | Admin Only | Reads and edits reference table entries |
| `/api/v1/admin/audit-logs` | GET | Admin Only | Paginated query of system and entity audit logs |
| `/api/v1/transactions/investment` | GET, POST, PUT, DELETE | User | CRUD for trade execution records |
| `/api/v1/transactions/capital` | GET, POST, PUT, DELETE | User | CRUD for capital deposit/withdrawal records |
| `/api/v1/transactions/trans-cost` | GET, POST, PUT, DELETE | User | CRUD for fee and margin cost records |
| `/api/v1/watchlist` | GET, POST, PUT, DELETE | User | CRUD for user watchlist items |

---

## 5. UI Rebuild: "Paper-Based" Design System & Admin UIs

### 5.1 Design System: Paper Aesthetic with Clean Lines
The user requirement dictates:
> *"The default UI to be white-based, clean lines, just like reading from a paper. High-contrast colors for charts."*

1. **Color Palette (Paper Tokens)**:
   - `Canvas / Background`: Crisp off-white `#FBFBFC` (simulating high-grade bond paper).
   - `Card / Sheet Surface`: Pure white `#FFFFFF`.
   - `Elevated Surface / Inputs`: Light parchment `#F1F5F9`.
   - `Clean Line / Borders`: Ultra-crisp thin border `#E2E8F0` and dividing rule `#CBD5E1` (`1px` hair-lines).
   - `Primary Ink (Typography)`: Deep charcoal black `#0F172A` (high contrast, crisp ink).
   - `Secondary Ink`: Muted slate `#475569`.
   - `Muted / Footnotes`: Cool gray `#94A3B8`.
2. **High-Contrast Chart Palette**:
   - `Primary Stock / Bullish`: Deep cobalt blue `#1D4ED8` or crisp forest emerald `#047857`.
   - `Bearish / Drawdown`: Sharp carmine red `#B91C1C`.
   - `Comparative Benchmark`: High-contrast amber `#D97706` (dashed).
   - `Overlays / Moving Averages`: Violet `#6D28D9`, Teal `#0E7490`.
   - `Chart Grid`: Ultra-light clean hair-lines `#E2E8F0` on white background.
3. **Typography**:
   - Body & Controls: `Inter`, `-apple-system`, `sans-serif` (clean, printed-page clarity).
   - Numeric Data & Tables: `JetBrains Mono` (tabular lining numbers, zero-width variation).
   - Headers: `Plus Jakarta Sans` with sharp geometric definition.

### 5.2 Application Frame & Structural Shell
1. **Top Panel**:
   - Pure white background (`#FFFFFF`) with thin bottom border (`#E2E8F0`).
   - AlphaInsight clean serif/geometric logo on the left.
   - User profile badge and explicit Role pill on the right.
   - Logout button.
2. **Left Panel Menu**:
   - **100% Driven by `site_map` table**: The client queries `GET /api/v1/sitemap` upon session initialization.
   - Tree navigation rendered dynamically:
     - `My Portfolio` -> `Transactions` (`Investment`, `Capital`, `Trans Cost`), `Watch List`
     - `Research` -> `Stock Analyst`, `Macroeconomics`, `By Industry/Sector` (placeholders)
     - `Investment Notes` (placeholder)
     - `Admin` -> `User Admin`, `Site Map Admin`, `Ref Data Editor`, `Audit Logs`
   - Only nodes matching the user's role are rendered.
3. **Admin Sub-Application UIs**:
   - **User Admin**: Clean paper-style data table listing all registered users, roles, email, creation date, status switch (`active`/`expired`), and role toggle buttons.
   - **Site Map Admin**: Tree editor allowing admins to add, rename, reorder (`order_index`), change icons, toggle visibility (`is_active`), and set required roles for any menu item.
   - **Ref Data Editor**: Interactive table inspector and editor for `sysvalue` and `ref_chart_settings`.
   - **Audit Logs View**: Filterable log table displaying timestamp, user email, action, entity name, and expandable JSON diffs of changes.

---

## 6. Machine-Readable Documentation Architecture

To establish comprehensive context for future agentic engineering swarms (Epic 0.3 & 0.4), Epic 0.2 deliverables include structured, machine-readable specifications:
1. **System Architecture Document (`docs/architecture.md`)**:
   - Adopts the Vitalis layered architecture standard: Clean boundary separation between database DDL, repositories, service domain logic, and API route controllers.
2. **Frozen Schema & API Contracts (`.agents/contracts/`)**:
   - Database DDL schema specifications (`.agents/contracts/database_schema.sql`).
   - Formal TypeScript contract definitions (`frontend/src/types/api.ts`).
   - OpenAPI 3.1 JSON export generated directly from FastAPI (`docs/openapi.json`).
3. **Design System Specification (`docs/design_system.md`)**:
   - Machine-readable token dictionary (`DESIGN_TOKENS`) defining color hex codes, line weights, font families, and high-contrast chart palettes.

---

## 7. Success Criteria & Verification Matrix

| ID | Category | Requirement / Success Criteria | Verification Method |
| :--- | :--- | :--- | :--- |
| **SC-01** | Database DDL | Migration `0003` creates `site_map`, `audit_log`, `trans_cost`, `ref_chart_settings` on `4leafclover_dev`. | `uv run alembic upgrade head` exits code 0; inspect table existence. |
| **SC-02** | Dynamic Sitemap | Navigation sidebar renders 100% from database rows via `GET /api/v1/sitemap`. | Modifying a label in `site_map` table immediately updates UI menu on refresh. |
| **SC-03** | RBAC Entitlement | Non-admin users cannot see Admin menu items or call `/api/v1/admin/*` endpoints. | Automated API test verifies `403 Forbidden` for standard users. |
| **SC-04** | Audit Logging | Modifying user role or editing ref data generates an audit row in `audit_log`. | Query `audit_log` table confirming entry with `action` and `new_values`. |
| **SC-05** | 100% API Protocol | Frontend makes zero direct SQL calls; all transactions/watchlist/admin operations use REST. | Network inspection confirms all UI actions invoke `/api/v1/*`. |
| **SC-06** | White Paper UI | Default UI is white-based with paper aesthetic (`#FFFFFF`/`#FBFBFC`, `#E2E8F0` borders, `#0F172A` ink). | Automated design system test verifies zero dark background regressions in default theme. |
| **SC-07** | Admin UIs | All 4 admin sub-apps (User, Site Map, Ref Data, Audit Logs) are fully functional. | Manual/Vitest walkthrough of each admin screen. |
| **SC-08** | Machine-Readable Docs | `docs/architecture.md`, `docs/openapi.json`, and `.agents/contracts/` generated. | Files exist and validate against markdown/JSON linters. |
