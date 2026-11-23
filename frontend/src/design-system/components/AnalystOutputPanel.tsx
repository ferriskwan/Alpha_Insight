import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { AgentAnalystOutputDTO, AnalystRoleType } from '../../types/api';
import { RichMarkdown } from './RichMarkdown';
import { TimelineRunNavigator, RunHistoryItem } from './TimelineRunNavigator';

export interface AnalystOutputTabItem {
  role: AnalystRoleType;
  label: string;
  subtitle: string;
}

export interface AnalystOutputPanelProps {
  tabs: AnalystOutputTabItem[];
  activeTab: AnalystRoleType;
  onTabChange: (role: AnalystRoleType) => void;
  outputsByRole: Partial<Record<AnalystRoleType, AgentAnalystOutputDTO>>;
  activeRun?: {
    id: number;
    model: string;
    consensus_bias: string;
    executive_summary: string;
    vote_breakdown?: Record<string, string>;
  } | null;
  runs?: RunHistoryItem[];
  onSelectRun?: (runId: number) => void;
  selectedSymbol?: string;
  running?: boolean;
  loadingInitial?: boolean;
  selectedModel?: string;
  pastOutputsCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onReferenceInNote?: (output: AgentAnalystOutputDTO) => void;
  ariaLabel?: string;
}

export const getAnalystBiasBadgeClasses = (bias?: string): string => {
  if (bias === 'Bullish') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (bias === 'Bearish') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-300';
};

export const getAnalystTrendBadgeClasses = (trend?: string): string => {
  if (trend === 'Reversal' || trend === 'Gap') {
    return 'bg-amber-50 text-amber-600 border-amber-200';
  }
  if (trend === 'Continuation') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

export const AnalystOutputPanel: React.FC<AnalystOutputPanelProps> = ({
  tabs,
  activeTab,
  onTabChange,
  outputsByRole,
  activeRun,
  runs = [],
  onSelectRun,
  selectedSymbol,
  running = false,
  loadingInitial = false,
  selectedModel = 'gemini-4-neon',
  pastOutputsCount = 0,
  emptyTitle = 'No stored analysis run yet.',
  emptyDescription = 'Click "Perform Analysis" above to dispatch the specialist agents.',
  onReferenceInNote,
  ariaLabel = 'Specialist Analysis Tabs',
}) => {
  const activeTabMeta = tabs.find((t) => t.role === activeTab) || tabs[0];
  const currentTabOutput = outputsByRole[activeTab];

  const totalVoteKeys = activeRun?.vote_breakdown
    ? Object.keys(activeRun.vote_breakdown).length
    : 4;
  const bullVotes = activeRun?.vote_breakdown
    ? Object.values(activeRun.vote_breakdown).filter((v) => v === 'Bullish').length
    : 0;
  const bearVotes = activeRun?.vote_breakdown
    ? Object.values(activeRun.vote_breakdown).filter((v) => v === 'Bearish').length
    : 0;

  const groundingLinks: { title: string; uri: string }[] = Array.isArray(
    currentTabOutput?.structured_metrics?.grounding_links
  )
    ? currentTabOutput.structured_metrics.grounding_links
    : [];

  return (
    <div
      data-testid="executive-summary-card"
      className="bg-white border border-slate-200 p-4 rounded-md flex flex-col justify-between h-full min-h-[780px]"
    >
      <div className="flex flex-col flex-1 min-h-0 space-y-3">
        {/* Specialist Tab Navigation Bar with Timeline Run Navigator */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div
            role="tablist"
            aria-label={ariaLabel}
            data-testid="segregated-analysts-grid"
            className="flex flex-wrap items-center gap-1"
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.role;
              const tabOut = outputsByRole[tab.role];
              return (
                <button
                  key={tab.role}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={
                    tab.role === 'executive_summary'
                      ? 'analyst-tab-executive_summary'
                      : `analyst-card-${tab.role}`
                  }
                  onClick={() => onTabChange(tab.role)}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tabOut && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        tabOut.directional_bias === 'Bullish'
                          ? 'bg-emerald-700'
                          : tabOut.directional_bias === 'Bearish'
                          ? 'bg-red-700'
                          : 'bg-slate-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {runs && runs.length > 0 && onSelectRun && (
            <TimelineRunNavigator
              runs={runs}
              activeRunId={activeRun?.id}
              onSelectRun={onSelectRun}
              selectedSymbol={selectedSymbol}
            />
          )}
        </div>

        {/* Active Tab Metadata Subheader */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-900">{activeTabMeta?.label}</div>
            <span className="text-[11px] font-mono text-slate-500">
              {activeRun
                ? `Run #${activeRun.id} • ${activeRun.model}`
                : activeTabMeta?.subtitle}
            </span>
          </div>

          {activeTab === 'executive_summary' && activeRun ? (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${getAnalystBiasBadgeClasses(
                activeRun.consensus_bias
              )}`}
            >
              {activeRun.consensus_bias.toUpperCase()} (
              {activeRun.consensus_bias === 'Bearish' ? bearVotes : bullVotes}/{totalVoteKeys} Votes)
            </span>
          ) : currentTabOutput ? (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${getAnalystBiasBadgeClasses(
                currentTabOutput.directional_bias
              )}`}
            >
              {currentTabOutput.directional_bias.toUpperCase()} (
              {currentTabOutput.confidence_score}%)
            </span>
          ) : null}
        </div>

        {/* Full-Height Tab Content Area */}
        {running ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-2">
            <div className="w-3 h-3 rounded-full bg-blue-700 animate-ping mx-auto" />
            <div className="text-xs font-semibold text-slate-900">
              Executing Specialist Agents via {selectedModel}...
            </div>
            <p className="text-[11px] text-slate-500">
              Comparing against {pastOutputsCount} historical outputs with live Google Search
              citation grounding.
            </p>
          </div>
        ) : currentTabOutput ? (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
              <span className="font-mono font-semibold text-slate-800">
                Confidence: {currentTabOutput.confidence_score}%
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono border ${getAnalystTrendBadgeClasses(
                  currentTabOutput.trend_status
                )}`}
              >
                Trend Status: {currentTabOutput.trend_status} vs Prior Runs
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 shrink-0">
              {currentTabOutput.summary_headline}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 max-h-[580px]">
              <RichMarkdown
                content={
                  activeTab === 'executive_summary' && activeRun
                    ? activeRun.executive_summary
                    : currentTabOutput.markdown_output
                }
              />
            </div>

            {/* Verified Grounding Sources & Citations Pill Bar */}
            {groundingLinks.length > 0 && (
              <div
                data-testid="verified-grounding-sources"
                className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5 shrink-0"
              >
                <div className="text-[10px] font-mono font-bold uppercase text-slate-600">
                  Verified Grounding Sources &amp; Citations ({groundingLinks.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groundingLinks.map((link, idx) => (
                    <a
                      key={`${link.uri}-${idx}`}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-white border border-slate-300 hover:border-blue-600 text-[11px] font-mono text-blue-700 inline-flex items-center gap-1 transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{link.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {loadingInitial ? 'Loading latest analysis run...' : emptyTitle}
            </p>
            <p className="text-[11px] text-slate-500">{emptyDescription}</p>
          </div>
        )}
      </div>

      {/* Reference in Note Footer */}
      {currentTabOutput && onReferenceInNote && (
        <div className="pt-3 mt-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => onReferenceInNote(currentTabOutput)}
            data-testid={
              activeTab === 'executive_summary'
                ? 'reference-in-note-executive_summary'
                : `reference-in-note-${activeTab}`
            }
            className="w-full py-1.5 px-3 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            <span>Reference {activeTabMeta?.label} in Note</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AnalystOutputPanel;
