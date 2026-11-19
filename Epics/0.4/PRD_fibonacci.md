# Product Requirements Document (PRD) — Fibonacci Retracement 52-Week Harmonization & Config Persistence

**Feature**: Unified 52-Week Fibonacci Retracements & `ref_chart_settings` Configuration  
**Target Module**: `Stock Analysis` (`/research/committee`), `InteractiveCanvasChart`, and `Reference Data Editor` (`/admin/ref-data`)  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  

---

## 1. Problem Statement & Current State Analysis
* **Observed Discrepancy**: In the `Stock Analysis` view for `D05.SI`:
  * The **Interactive Canvas Chart** calculated Fibonacci levels based on a hardcoded 6-month slice (`126` bars), displaying:
    * `Fib 0.0% (High)`: `78.15`
    * `Fib 23.6%`: `74.10`
    * `Fib 38.2%`: `71.60`
    * `Fib 50.0%`: `69.57`
    * `Fib 61.8%`: `67.55`
    * `Fib 100.0% (Low)`: `61.00`
  * The **Agentic Analyst Committee (`Technical` & `Exec Summary`)** calculated Fibonacci levels over all historical database rows in `eoddata` without a window constraint, citing:
    * `23.6% Fibonacci retracement` at `67.76`
    * `38.2% Fibonacci support` at `61.36`
* **Root Cause**: The chart and the agentic prompt builder used completely decoupled lookback windows (`126` bars vs entire historical lifetime). Furthermore, Fibonacci lookback parameters were not stored in the database or configurable via the Reference Data Editor.

---

## 2. Proposed System Architecture & Solution
1. **Database Persistence (`public.ref_chart_settings`)**:
   - Extend `ref_chart_settings` via Alembic migration `0007_ref_chart_settings_fibonacci.py` with:
     - `fib_lookback_bars` (`Integer`, default `252` — representing 52 weeks / 1 trading year).
     - `fib_intraday_bars` (`Integer`, default `78` — representing 1 full standard trading session of 5-minute bars).
2. **Harmonized Server-Side Calculation**:
   - `committee_repo.py` and `research_repo.py` will read `ref_chart_settings` (user-specific, symbol-specific, or global defaults).
   - Multi-day Fibonacci levels will anchor strictly to the **52-week High and Low** (`slice(-252)`), calculating:
     - $R = \text{High}_{52w} - \text{Low}_{52w}$
     - $\text{Fib}_{0.0\%} = \text{High}_{52w}$
     - $\text{Fib}_{23.6\%} = \text{High}_{52w} - 0.236 \times R$
     - $\text{Fib}_{38.2\%} = \text{High}_{52w} - 0.382 \times R$
     - $\text{Fib}_{50.0\%} = \text{High}_{52w} - 0.500 \times R$
     - $\text{Fib}_{61.8\%} = \text{High}_{52w} - 0.618 \times R$
     - $\text{Fib}_{78.6\%} = \text{High}_{52w} - 0.786 \times R$
     - $\text{Fib}_{100.0\%} = \text{Low}_{52w}$
   - Return canonical `fibonacci_levels` in the API response payload.
3. **Frontend Chart Synchronization**:
   - Update `InteractiveCanvasChart.tsx` to use the 52-week default window (`252` bars) for Multi-day mode and `78` bars for Intraday mode, or bind directly to the canonical levels returned from the backend.
4. **Reference Data Editor UI (`/admin/ref-data`)**:
   - Add a dedicated **Fibonacci Retracements** card to the "Chart Technical Settings" tab in `RefDataEditor.tsx`, allowing administrators and users to view and adjust `fib_lookback_bars` and `fib_intraday_bars`.

---

## 3. Success Criteria (Acceptance Test Gates)
- [ ] **SC-FIB-01 (Database Schema)**: Alembic migration `0007` applies cleanly on `4leafclover_dev` and SQLite test databases, adding `fib_lookback_bars` (default `252`) and `fib_intraday_bars` (default `78`) to `public.ref_chart_settings`.
- [ ] **SC-FIB-02 (API Contract & CRUD)**: `GET /api/v1/ref-data/chart-settings` and `PUT /api/v1/ref-data/chart-settings` serialize and update `fib_lookback_bars` and `fib_intraday_bars`.
- [ ] **SC-FIB-03 (Calculation Consistency)**: Both the backend prompt builder (`technical_context["fibonacci_levels"]`) and `InteractiveCanvasChart` evaluate to the exact same Fibonacci price levels based on the 52-week cycle (`252` bars).
- [ ] **SC-FIB-04 (Reference Data UI)**: The `RefDataEditor.tsx` component exposes form fields for `fib_lookback_bars` and `fib_intraday_bars` under `Chart Technical Settings` with save confirmation.
- [ ] **SC-FIB-05 (Automated Test Coverage)**: Fast Targeted Gate (`ruff`, `mypy`, `pytest tests/backend/test_committee_and_notes.py`, `vitest run`) passes with exit code 0.
