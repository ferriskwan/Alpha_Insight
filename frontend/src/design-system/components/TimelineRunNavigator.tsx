import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, Check } from 'lucide-react';
import { getAnalystBiasBadgeClasses } from './AnalystOutputPanel';

export interface RunHistoryItem {
  id: number;
  model: string;
  consensus_bias: string;
  summary_headline?: string;
  created_at: string;
}

export interface TimelineRunNavigatorProps {
  runs: RunHistoryItem[];
  activeRunId?: number;
  onSelectRun: (runId: number) => void;
  selectedSymbol?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

function toLocalDateKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

export const TimelineRunNavigator: React.FC<TimelineRunNavigatorProps> = ({
  runs,
  activeRunId,
  onSelectRun,
  selectedSymbol,
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!runs || runs.length === 0) {
    return null;
  }

  // Find active run index (0 is latest, runs.length - 1 is oldest)
  const activeIndex = activeRunId !== undefined
    ? runs.findIndex((r) => r.id === activeRunId)
    : 0;
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentRun = runs[safeIndex] || runs[0];

  // Calendar view month state initialized to current run's date
  const runDate = new Date(currentRun.created_at);
  const initialYear = isNaN(runDate.getTime()) ? new Date().getFullYear() : runDate.getFullYear();
  const initialMonth = isNaN(runDate.getTime()) ? new Date().getMonth() : runDate.getMonth();

  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    }
    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarOpen]);

  // Map dates to runs for indicator dots on calendar
  const runsByDate = React.useMemo(() => {
    const map = new Map<string, RunHistoryItem[]>();
    for (const r of runs) {
      const k = toLocalDateKey(r.created_at);
      if (k) {
        const arr = map.get(k) || [];
        arr.push(r);
        map.set(k, arr);
      }
    }
    return map;
  }, [runs]);

  const canStepBack = safeIndex < runs.length - 1; // Older runs are at higher indices
  const canStepForward = safeIndex > 0; // Newer runs are at lower indices

  const handleStepBack = () => {
    if (canStepBack) {
      onSelectRun(runs[safeIndex + 1].id);
    }
  };

  const handleStepForward = () => {
    if (canStepForward) {
      onSelectRun(runs[safeIndex - 1].id);
    }
  };

  // Calendar month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar days for viewMonth / viewYear
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const activeDateKey = toLocalDateKey(currentRun.created_at);

  return (
    <div className="relative inline-flex items-center gap-1 shrink-0" ref={containerRef}>
      {/* Step Backward (Older Run) */}
      <button
        type="button"
        onClick={handleStepBack}
        disabled={!canStepBack}
        title={canStepBack ? `View previous analysis (Run #${safeIndex + 2} of ${runs.length})` : 'Oldest analysis reached'}
        aria-label="Previous analysis"
        data-testid="timeline-step-prev"
        className={`p-1.5 rounded border text-xs font-semibold transition-colors flex items-center justify-center ${
          canStepBack
            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-2xs'
            : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'
        }`}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Date & Run Trigger Button */}
      <button
        type="button"
        onClick={() => setCalendarOpen(!calendarOpen)}
        title="Select past analysis from calendar"
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        data-testid="timeline-date-trigger"
        className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs font-mono font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 text-blue-700 shrink-0" />
        <span className="font-semibold text-slate-900">{formatDisplayDate(currentRun.created_at)}</span>
        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded">
          Run #{safeIndex + 1} of {runs.length}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
      </button>

      {/* Step Forward (Newer Run) */}
      <button
        type="button"
        onClick={handleStepForward}
        disabled={!canStepForward}
        title={canStepForward ? `View next analysis (Run #${safeIndex} of ${runs.length})` : 'Latest analysis reached'}
        aria-label="Next analysis"
        data-testid="timeline-step-next"
        className={`p-1.5 rounded border text-xs font-semibold transition-colors flex items-center justify-center ${
          canStepForward
            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-2xs'
            : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'
        }`}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Calendar & Past Runs Dropdown Popover */}
      {calendarOpen && (
        <div
          data-testid="timeline-calendar-popover"
          className="absolute right-0 top-full mt-1.5 z-50 w-80 md:w-88 bg-white border border-slate-200 rounded-md shadow-lg p-3 text-xs space-y-3"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-900 font-mono">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Calendar Day-of-Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 font-semibold uppercase">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank leading days */}
            {Array.from({ length: firstDayWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 w-7" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayRuns = runsByDate.get(dKey) || [];
              const hasRuns = dayRuns.length > 0;
              const isActive = dKey === activeDateKey;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={!hasRuns}
                  onClick={() => {
                    if (hasRuns) {
                      onSelectRun(dayRuns[0].id);
                      setCalendarOpen(false);
                    }
                  }}
                  className={`h-7 w-7 mx-auto rounded flex flex-col items-center justify-center text-[11px] font-mono transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-300'
                      : hasRuns
                      ? 'hover:bg-slate-100 text-slate-900 font-semibold cursor-pointer'
                      : 'text-slate-300 cursor-default'
                  }`}
                >
                  <span>{dayNum}</span>
                  {hasRuns && (
                    <span className="w-1 h-1 rounded-full bg-blue-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Completed Runs List */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 uppercase mb-1.5">
              <span>Completed Analyses ({runs.length})</span>
              {selectedSymbol && <span className="text-blue-700">{selectedSymbol}</span>}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {runs.map((r, idx) => {
                const isSelected = r.id === currentRun.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelectRun(r.id);
                      setCalendarOpen(false);
                    }}
                    data-testid={`timeline-run-item-${r.id}`}
                    className={`w-full text-left p-2 rounded text-xs transition-colors cursor-pointer flex items-start justify-between gap-2 border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">
                          {formatDisplayDate(r.created_at)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          (Run #{idx + 1})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                        {r.model} {r.summary_headline ? `• ${r.summary_headline}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getAnalystBiasBadgeClasses(
                          r.consensus_bias
                        )}`}
                      >
                        {r.consensus_bias}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-700 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineRunNavigator;
