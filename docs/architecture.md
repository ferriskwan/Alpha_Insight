# Alpha_Insight System Architecture & Epic 0.2 Specification

**Application Name**: Alpha_Insight (Vitalis Platform)  
**Target Environment**: Google Cloud Run & Cloud SQL PostgreSQL (`4leafclover_dev`)  
**Design System**: White Paper Aesthetic (`Aptos` default typography, `#FFFFFF` sheets, `#FBFBFC` canvas, `#E2E8F0` hairline dividing lines)  

---

## 1. Architectural Overview & Layering

Alpha_Insight adheres strictly to a clean 4-tier layered architecture:

```
+-------------------------------------------------------------------------+
|                         Presentation Layer (React 18 + Vite)            |
| - AppShell (Whitepaper Header, Environment Pill, Role Switcher)         |
| - DynamicSidebar (100% DB-driven from /api/v1/sitemap, RBAC filtered)  |
| - Admin Suite: UserAdmin, SiteMapAdmin, RefDataEditor, AuditLogsViewer  |
| - Scaffolds: Portfolio Overview, Transactions (Trans Cost), Research    |
+-------------------------------------------------------------------------+
                                     |
                                     | (100% REST APIs / JSON over HTTPS)
                                     v
+-------------------------------------------------------------------------+
|                        API Routing Layer (FastAPI 0.115)                |
| - /api/v1/sitemap               -> Dynamic navigation tree & RBAC       |
| - /api/v1/admin/sitemap         -> Sitemap CRUD & ordering              |
| - /api/v1/admin/ref-data        -> SysValue & Chart Settings CRUD       |
| - /api/v1/admin/audit-logs      -> System compliance & mutation trail   |
| - /api/v1/admin/users           -> User RBAC & account status           |
| - /api/v1/transactions/trans-cost -> Trade & standalone fees           |
| - /api/v1/auth                  -> Google OAuth2 & persistent sessions  |
+-------------------------------------------------------------------------+
                                     |
                                     | (Domain Entities & DTOs)
                                     v
+-------------------------------------------------------------------------+
|                    Repository & Service Layer (Stateless)               |
| - sitemap_repo.py   -> Recursive tree assembly & role node filtering    |
| - audit_repo.py     -> Automated diff logging on all admin mutations    |
| - ref_data_repo.py  -> Multi-tier chart settings resolution cascade     |
| - portfolio_repo.py -> Cost allocation & portfolio aggregation          |
+-------------------------------------------------------------------------+
                                     |
                                     | (SQLAlchemy 2.0 Async/Sync ORM)
                                     v
+-------------------------------------------------------------------------+
|                  Persistence Layer (Cloud SQL PostgreSQL)               |
| - Instance: gen-lang-client-0632004807:asia-southeast1:clover          |
| - Database: 4leafclover_dev                                             |
| - Migrations: Alembic revisions 0001 -> 0002 -> 0003                    |
| - Tables: site_map, audit_log, trans_cost, ref_chart_settings, etc.     |
+-------------------------------------------------------------------------+
```

---

## 2. Core Subsystems

### 2.1 Dynamic Database-Driven Site Map & RBAC
- **Database Table**: `site_map`
- **Zero Hardcoded Menus**: Frontend navigation menus are 100% dynamically fetched from `GET /api/v1/sitemap`.
- **RBAC Filtering**: The endpoint accepts the caller's role (`user`, `analyst`, `admin`). Nodes are filtered such that:
  - `user`: sees only user-permitted routes (`role_required = 'user'`).
  - `analyst`: sees `user` and `analyst` routes.
  - `admin`: sees all routes, including the full Admin application suite.
- **Admin Management**: Through `SiteMapAdmin`, administrators can reorder nodes, modify routes/labels, change required roles, and toggle node visibility in real time.

### 2.2 System Mutation Audit Logging
- **Database Table**: `audit_log`
- Every mutation on administrative entities (`site_map`, `sysvalue`, `ref_chart_settings`, `users`) automatically dispatches a call to `audit_repo.log_action`.
- Records: `user_id`, `action` (`CREATE`, `UPDATE`, `DELETE`), `entity`, `entity_id`, `old_values` (JSONB), `new_values` (JSONB), `ip_address`, `user_agent`, and `timestamp`.
- Frontend `AuditLogsViewer` renders mutations with an expandable visual diff viewer highlighting deleted/previous values and new values.

### 2.3 Reference Data & Technical Indicator Settings
- **Database Tables**: `sysvalue` and `ref_chart_settings`
- **SysValue**: Stores global configuration variables and runtime parameters (`type`, `strvalue`, `numvalue`, `datevalue`).
- **RefChartSettings**: Provides technical analysis indicator parameters (SMA period, EMA period, Bollinger Band period & std, RSI period/overbought/oversold, MACD fast/slow/signal).
- **Fallback Resolution Cascade**:
  1. User + Symbol specific configuration
  2. User global default (`symbol IS NULL`)
  3. Symbol global default (`user_id IS NULL`)
  4. System global default (`user_id IS NULL AND symbol IS NULL`)

### 2.4 Transaction Cost Breakdown
- **Database Table**: `trans_cost`
- Stores individual fee items categorized by `cost_type` (`commission`, `sec_fee`, `finra_taf`, `platform_fee`, `borrow_fee`, `other`).
- Can be linked directly to an execution (`trade_id`) or recorded standalone for general account costs.

---

## 3. White Paper Design System & Aptos Typography

- **Default Font**: `'Aptos', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif`
- **Background Palette**:
  - Paper Sheets: `#FFFFFF`
  - Canvas: `#FBFBFC`
  - Subtle Sections: `#F8FAFC`
- **Dividers & Borders**: `#E2E8F0` thin 1px hairlines
- **Typography Palette**:
  - Deep Ink: `#0F172A`
  - Slate Muted: `#475569`
  - Faint Labels: `#94A3B8`
- **High-Contrast Chart Palette**:
  - Cobalt Blue: `#1D4ED8`
  - Forest Emerald: `#047857`
  - Carmine Red: `#B91C1C`
  - Amber / Warning: `#D97706`
