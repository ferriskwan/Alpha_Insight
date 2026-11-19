# UI/UX Design Specification — Epic 0.4: Historical Analysis Timeline Navigation & Calendar Picker

**Epic**: 0.4 (Deliverable Review Workstream 8)  
**Target View**: `Stock Analysis` (`/research/committee`) -> `AnalystOutputPanel.tsx`  
**Aesthetic Style**: Alpha_Insight White Paper Aesthetic (Institutional Minimalist, Slate/Blue palette, 1px hairline dividers)  

---

## 1. Visual Mockup Reference

![Historical Analysis Timeline Navigation & Calendar Picker](/C:/Users/ferri/.gemini/antigravity/brain/001e0c39-1623-48b7-8c9f-8e2d2beee5cb/alpha_insight_timeline_nav_mockup_final_1795072795654.jpg)

---

## 2. Layout Structure & Placement

The timeline navigation component sits directly on the right side of the specialist tab navigation row at the top of the right analyst panel (`AnalystOutputPanel.tsx`):

```
+--------------------------------------------------------------------------------------------------------------------+
| [Exec Summary *] [Technical *] [Fundamental *] [Macro *] [Risk Mgt *]   |   [ < ]  [ 18-Nov-2026 14:30 ▾ ]  [ > ]  |
+--------------------------------------------------------------------------------------------------------------------+
```

### Component Breakdown
1. **Container Alignment**:
   - The tab bar container uses `flex flex-wrap items-center justify-between border-b border-slate-200 pb-2`.
   - Specialist tabs (`[Exec Summary]`, `[Technical]`, etc.) are left-aligned.
   - The **Timeline Navigation Group** is right-aligned (`ml-auto flex items-center gap-1`).

2. **Step Backward Button `[ < ]`**:
   - Icon: `<ChevronLeft className="w-3.5 h-3.5" />`
   - Purpose: Steps backward to the chronologically prior analysis run (`runs[currentIndex + 1]`).
   - State:
     - Enabled: `border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200`
     - Disabled: `opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200` (when at the oldest available run).
   - Tooltip: `"Previous analysis ({date})"`

3. **Analysis Date Trigger Button `[ 18-Nov-2026 14:30 ▾ ]`**:
   - Icon: `<Calendar className="w-3.5 h-3.5 text-blue-700 mr-1.5" />`
   - Text: Date string formatted as `DD-MMM-YYYY HH:mm` (e.g. `18-Nov-2026 14:30`).
   - Secondary Pill: Subtle badge indicating run position, e.g. `<span className="ml-1.5 px-1 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded">Run #1 of 5</span>`.
   - Chevron: `<ChevronDown className="w-3 h-3 text-slate-500 ml-1" />`
   - Interaction: Clicking toggles the floating **Calendar & Past Runs Popover**.

4. **Step Forward Button `[ > ]`**:
   - Icon: `<ChevronRight className="w-3.5 h-3.5" />`
   - Purpose: Steps forward to the newer analysis run (`runs[currentIndex - 1]`).
   - State:
     - Enabled: `border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200`
     - Disabled: `opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200` (when already viewing the latest run).
   - Tooltip: `"Next analysis ({date})" / "Already on latest analysis"`

---

## 3. Calendar & Past Runs Popover Design

When the date trigger button is clicked, an anchored popover opens directly below:

```
+------------------------------------------------------------------------+
|  November 2026                                            [ < ]  [ > ] |
|  Su  Mo  Tu  We  Th  Fr  Sa                                            |
|   1   2   3   4   5   6   7                                            |
|   8   9  10  11  12  13  14   (Highlighted dots on days with analyses) |
|  15  16  17 [18] 19  20  21                                            |
|  22  23  24  25  26  27  28                                            |
|  29  30                                                                |
+------------------------------------------------------------------------+
|  Completed Analyses for D05.SI                                         |
|                                                                        |
|  ● 18-Nov-2026 14:30 · gemini-4-argon              [Neutral (1/4)]  ✓ |
|    "Initiation: Bearish breakdown below lower BB..."                   |
|                                                                        |
|  ○ 14-Nov-2026 09:15 · gemini-4-argon              [Bullish (3/4)]    |
|    "Continuation: Support held at 61.8% Fibonacci..."                  |
|                                                                        |
|  ○ 08-Nov-2026 16:45 · gemini-4-argon              [Bearish (2/4)]    |
|    "Reversal: MACD histogram divergence..."                           |
+------------------------------------------------------------------------+
```

### Popover Structure:
- **Dimensions & Positioning**: `w-80 md:w-96`, absolute positioning with `right-0 top-full mt-1.5 z-50`.
- **Styling**: `bg-white border border-slate-200 rounded-md shadow-lg p-3 text-xs`.
- **Top Section (Mini Calendar Grid)**:
  - Month/Year header with prev/next month controls.
  - Days with recorded analysis runs display an indicator dot beneath the date number (`w-1.5 h-1.5 rounded-full bg-blue-600`).
  - Active run date is highlighted with a solid blue ring or background (`bg-blue-50 text-blue-700 font-bold border border-blue-300`).
  - Clicking a date with runs scrolls/filters the list to that run.
- **Bottom Section (Run Selection List)**:
  - Scrollable container (`max-h-56 overflow-y-auto space-y-1 divide-y divide-slate-100`).
  - Each item shows:
    - Timestamp: `18-Nov-2026 14:30`
    - Model: `gemini-4-argon`
    - Consensus Bias badge: `Bullish` (emerald), `Bearish` (red), `Neutral` (slate).
    - Headline excerpt: First 50 characters of `summary_headline`.
  - Currently active run shows a checkmark `<Check className="w-3.5 h-3.5 text-blue-700" />` and blue tint background.
  - Clicking any run immediately updates `activeRun`, closes the popover, and switches all 5 tabs to display that run's outputs.

---

## 4. Typography, Colors & Micro-Animations

- **Typography**: System default `Aptos` / clean sans-serif. Numbers and timestamps formatted in `font-mono`.
- **Color Palette**:
  - Primary Active: `bg-blue-700 text-white`
  - Subtle Hover: `hover:bg-slate-100 text-slate-700`
  - Popover Surface: `bg-white border-slate-200`
  - Calendar Active Day: `bg-blue-100 text-blue-800 font-bold border border-blue-300`
  - Analysis Run Dots: `bg-blue-600`
- **Micro-Animations**:
  - Popover entrance: `transition-all duration-150 ease-out transform opacity-100 scale-100` (from `opacity-0 scale-95`).
  - Button hover: `transition-colors duration-100`.
- **Outside Click Handling**: `useRef` and window click listener automatically close the popover when clicking anywhere outside.

---

## 5. Responsive Behavior

- On wide screens (`lg:` and above): The tab pills and the timeline navigation sit side-by-side on a single row.
- On smaller screens (`< 1024px`): The container wraps gracefully with `flex-wrap`, keeping the timeline navigation aligned to the right on a second line if horizontal width is constrained.
