import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Save,
  Trash2,
  Link2,
  X,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  InvestmentNoteDTO,
  WatchlistEnrichedItem,
  TradeRecord,
  AgentAnalystOutputDTO,
  ThesisStatusType,
} from '../../types/api';
import apiClient from '../../services/apiClient';
import { ModalDialog, DisplayedScreenContext, RichMarkdown } from '../../design-system';

export interface InvestmentNotesViewProps {
  initialSymbol?: string;
  initialLinkedOutput?: AgentAnalystOutputDTO | null;
  onClearInitialLinkedOutput?: () => void;
  onContextUpdate?: (ctx: DisplayedScreenContext) => void;
}

export const InvestmentNotesView: React.FC<InvestmentNotesViewProps> = ({
  initialSymbol = 'AAPL',
  initialLinkedOutput = null,
  onClearInitialLinkedOutput,
  onContextUpdate,
}) => {
  const [notes, setNotes] = useState<InvestmentNoteDTO[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEnrichedItem[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [availableOutputs, setAvailableOutputs] = useState<AgentAnalystOutputDTO[]>([]);

  // Filter state (Left Column)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Active Note Editor State (Right Column)
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteSymbol, setNoteSymbol] = useState<string>(initialSymbol || 'AAPL');
  const [noteTradeId, setNoteTradeId] = useState<string>('');
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteStatus, setNoteStatus] = useState<ThesisStatusType>('In-Progress');
  const [selectedOutputIds, setSelectedOutputIds] = useState<number[]>([]);

  // Picker Modal & Inspector State
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerRoleFilter, setPickerRoleFilter] = useState<string>('All');
  const [inspectingOutput, setInspectingOutput] = useState<AgentAnalystOutputDTO | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const distinctWatchlistSymbols = useMemo(() => {
    const seen = new Set<string>();
    const list: WatchlistEnrichedItem[] = [];
    for (const item of watchlist) {
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol);
        list.push(item);
      }
    }
    return list;
  }, [watchlist]);

  const loadAllData = async () => {
    const [wlItems, tradeItems, noteItems, outItems] = await Promise.all([
      apiClient.getWatchlistItems('All').catch(() => []),
      apiClient.getTrades().catch(() => []),
      apiClient.getInvestmentNotes({ limit: 100 }).catch(() => []),
      apiClient.getStoredAnalystOutputs({ limit: 100 }).catch(() => []),
    ]);

    if (wlItems && wlItems.length > 0) {
      setWatchlist(wlItems);
    } else {
      setWatchlist([
        {
          user_id: 1,
          symbol: 'AAPL',
          name: 'Apple Inc.',
          watchlistname: 'Default',
          lastPrice: 185.0,
          change: 1.4,
          changePct: 0.76,
          dayHigh: 186.5,
          dayLow: 183.2,
          volume: 2400000,
          high52: 199.62,
          low52: 164.08,
          currency: 'USD',
        },
        {
          user_id: 1,
          symbol: 'NVDA',
          name: 'NVIDIA Corp.',
          watchlistname: 'Default',
          lastPrice: 128.5,
          change: 3.1,
          changePct: 2.47,
          dayHigh: 130.0,
          dayLow: 125.0,
          volume: 4100000,
          high52: 140.76,
          low52: 75.6,
          currency: 'USD',
        },
      ]);
    }

    setTrades(tradeItems || []);
    setNotes(noteItems || []);
    setAvailableOutputs(outItems || []);

    if (noteItems && noteItems.length > 0 && selectedNoteId === null && !initialLinkedOutput) {
      selectNoteForEdit(noteItems[0]);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle incoming deep-link from AnalystCommitteeView ("Reference in Note")
  useEffect(() => {
    if (initialLinkedOutput) {
      setSelectedNoteId(null);
      setNoteSymbol(initialLinkedOutput.symbol);
      setNoteTradeId('');
      setNoteTitle(
        `${initialLinkedOutput.symbol} Thesis — Referenced ${initialLinkedOutput.analyst_role.replace('_', ' ')} #${initialLinkedOutput.id}`
      );
      setNoteContent(
        `### Core Thesis & Position Sizing\n\nReferenced from Run #${initialLinkedOutput.run_id} (${initialLinkedOutput.analyst_role}):\n- **Bias**: ${initialLinkedOutput.directional_bias} (${initialLinkedOutput.confidence_score}%)\n- **Trend Status**: ${initialLinkedOutput.trend_status}\n- **Summary**: ${initialLinkedOutput.summary_headline}\n`
      );
      setNoteStatus('In-Progress');
      setSelectedOutputIds([initialLinkedOutput.id]);
      setAvailableOutputs((prev) =>
        prev.some((o) => o.id === initialLinkedOutput.id) ? prev : [initialLinkedOutput, ...prev]
      );
      if (onClearInitialLinkedOutput) {
        onClearInitialLinkedOutput();
      }
    }
  }, [initialLinkedOutput]);

  const selectNoteForEdit = (note: InvestmentNoteDTO) => {
    setSelectedNoteId(note.id);
    setNoteSymbol(note.symbol);
    setNoteTradeId(note.trade_id ? String(note.trade_id) : '');
    setNoteTitle(note.title);
    setNoteContent(note.content_markdown);
    setNoteStatus(note.thesis_status);
    setSelectedOutputIds(note.analyst_output_ids || []);
  };

  const handleStartNewNote = () => {
    const defaultSym =
      distinctWatchlistSymbols.length > 0 ? distinctWatchlistSymbols[0].symbol : 'AAPL';
    setSelectedNoteId(null);
    setNoteSymbol(defaultSym);
    setNoteTradeId('');
    setNoteTitle('');
    setNoteContent('');
    setNoteStatus('In-Progress');
    setSelectedOutputIds([]);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (filterSymbol !== 'All' && n.symbol !== filterSymbol) return false;
      if (filterStatus !== 'All' && n.thesis_status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchBody = n.content_markdown.toLowerCase().includes(q);
        const matchSym = n.symbol.toLowerCase().includes(q);
        if (!matchTitle && !matchBody && !matchSym) return false;
      }
      return true;
    });
  }, [notes, filterSymbol, filterStatus, searchQuery]);

  const linkedOutputObjects = useMemo(() => {
    const idSet = new Set(selectedOutputIds);
    const fromAvailable = availableOutputs.filter((o) => idSet.has(o.id));
    if (fromAvailable.length === selectedOutputIds.length) return fromAvailable;

    const currentNote = notes.find((n) => n.id === selectedNoteId);
    const combinedMap = new Map<number, AgentAnalystOutputDTO>();
    for (const o of availableOutputs) combinedMap.set(o.id, o);
    if (currentNote && currentNote.linked_analyst_outputs) {
      for (const o of currentNote.linked_analyst_outputs) combinedMap.set(o.id, o);
    }
    return selectedOutputIds
      .map((id) => combinedMap.get(id))
      .filter((x): x is AgentAnalystOutputDTO => Boolean(x));
  }, [selectedOutputIds, availableOutputs, notes, selectedNoteId]);

  const symbolTrades = useMemo(() => {
    return trades.filter((t) => !noteSymbol || t.symbol === noteSymbol);
  }, [trades, noteSymbol]);

  const modalFilteredOutputs = useMemo(() => {
    return availableOutputs.filter((o) => {
      if (noteSymbol && o.symbol !== noteSymbol) return false;
      if (pickerRoleFilter !== 'All' && o.analyst_role !== pickerRoleFilter) return false;
      return true;
    });
  }, [availableOutputs, noteSymbol, pickerRoleFilter]);

  const toggleOutputSelection = (outputId: number) => {
    setSelectedOutputIds((prev) =>
      prev.includes(outputId) ? prev.filter((id) => id !== outputId) : [...prev, outputId]
    );
  };

  // Publish live displayed context for Floating [Agentic Analyst] Chat Window
  useEffect(() => {
    if (!onContextUpdate) return;
    const pills: string[] = [
      `Active Context: ${noteSymbol}`,
      selectedNoteId ? `Investment Note #${selectedNoteId}` : 'Draft Investment Note',
      `${selectedOutputIds.length} Analyst Output(s) Linked`,
    ];
    onContextUpdate({
      symbol: noteSymbol,
      activeRoute: '/notes',
      routeTitle: 'Investment Notes & Thesis Journal',
      contextPills: pills,
      data: {
        noteId: selectedNoteId,
        symbol: noteSymbol,
        title: noteTitle,
        thesisStatus: noteStatus,
        contentMarkdown: noteContent,
        tradeId: noteTradeId ? Number(noteTradeId) : null,
        linkedAnalystOutputsCount: selectedOutputIds.length,
        linkedAnalystOutputs: linkedOutputObjects,
      },
    });
  }, [
    selectedNoteId,
    noteSymbol,
    noteTitle,
    noteStatus,
    noteContent,
    noteTradeId,
    selectedOutputIds,
    linkedOutputObjects,
    onContextUpdate,
  ]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) {
      showNotification('error', 'Please provide both a Note Title and Markdown thesis content.');
      return;
    }

    setSaving(true);
    try {
      if (selectedNoteId !== null) {
        const updated = await apiClient.updateInvestmentNote(selectedNoteId, {
          symbol: noteSymbol,
          trade_id: noteTradeId ? Number(noteTradeId) : null,
          title: noteTitle.trim(),
          content_markdown: noteContent,
          thesis_status: noteStatus,
          analyst_output_ids: selectedOutputIds,
        });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        showNotification('success', `Investment Note #${updated.id} updated.`);
      } else {
        const created = await apiClient.createInvestmentNote({
          symbol: noteSymbol,
          trade_id: noteTradeId ? Number(noteTradeId) : null,
          title: noteTitle.trim(),
          content_markdown: noteContent,
          thesis_status: noteStatus,
          analyst_output_ids: selectedOutputIds,
        });
        setNotes((prev) => [created, ...prev]);
        setSelectedNoteId(created.id);
        showNotification('success', `Investment Note #${created.id} created.`);
      }
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (selectedNoteId === null) return;
    try {
      await apiClient.deleteInvestmentNote(selectedNoteId);
      const remaining = notes.filter((n) => n.id !== selectedNoteId);
      setNotes(remaining);
      showNotification('success', `Investment Note #${selectedNoteId} deleted.`);
      if (remaining.length > 0) {
        selectNoteForEdit(remaining[0]);
      } else {
        handleStartNewNote();
      }
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to delete note.');
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    if (status === 'Validated') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Invalidated') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-600 border-amber-200';
  };

  return (
    <div className="space-y-4" data-testid="investment-notes-view">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-700" />
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Investment Notes & Thesis Journal
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Watchlist-linked investment theses, trade rationale, and 0..N relational links to
            Autonomous Analyst outputs.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartNewNote}
          data-testid="new-note-btn"
          className="px-3 py-1.5 rounded bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Investment Note</span>
        </button>
      </div>

      {toast && (
        <div
          className={`p-3 rounded border text-xs font-medium flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-0.5 rounded hover:bg-white/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 35% / 65% Desktop Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (4 cols / ~33%): Filter & Note List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-3.5 rounded-md space-y-3 flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes & tickers..."
              aria-label="Search notes and tickers"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-blue-600"
            />
          </div>

          {/* Watchlist Symbol Filter */}
          <select
            aria-label="Filter notes by Watchlist Symbol"
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded text-slate-800 cursor-pointer"
          >
            <option value="All">Watchlist Symbol: All Symbols</option>
            {distinctWatchlistSymbols.map((w) => (
              <option key={w.symbol} value={w.symbol}>
                {w.symbol} — {w.name || w.symbol}
              </option>
            ))}
          </select>

          {/* Thesis Status Pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['All', 'In-Progress', 'Validated', 'Invalidated'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-colors ${
                  filterStatus === st
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Stacked Note Cards */}
          <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-0.5">
            {filteredNotes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
                No investment notes match the current filter.
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedNoteId === note.id;
                const linkCount = (note.analyst_output_ids || []).length;
                return (
                  <div
                    key={note.id}
                    onClick={() => selectNoteForEdit(note)}
                    data-testid={`note-list-item-${note.id}`}
                    className={`p-3 rounded-md border transition-colors cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 line-clamp-1">
                      {note.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-[10px] text-blue-700">
                        {note.symbol}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeClasses(
                          note.thesis_status
                        )}`}
                      >
                        {note.thesis_status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      {linkCount} Analyst {linkCount === 1 ? 'Output' : 'Outputs'} Linked
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (8 cols / ~67%): Note Editor & 0..N Relational Link Sheet */}
        <form
          onSubmit={handleSaveNote}
          className="lg:col-span-8 bg-white border border-slate-200 p-4 rounded-md space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            {/* Title Input */}
            <div>
              <label
                htmlFor="note-title-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Note Title
              </label>
              <input
                id="note-title-input"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. AAPL Q4 Breakout & Margin Risk Thesis"
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded focus:outline-hidden focus:border-blue-600"
              />
            </div>

            {/* Entity Linking Row: Watchlist Ticker + Linked Trade + Thesis Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="note-symbol-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Watchlist Ticker (from [watchlist])
                </label>
                <select
                  id="note-symbol-select"
                  aria-label="Watchlist Ticker"
                  value={noteSymbol}
                  onChange={(e) => setNoteSymbol(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded text-slate-900 cursor-pointer"
                >
                  {distinctWatchlistSymbols.map((w) => (
                    <option key={w.symbol} value={w.symbol}>
                      {w.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="note-trade-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Linked Trade (Optional)
                </label>
                <select
                  id="note-trade-select"
                  aria-label="Linked Trade"
                  value={noteTradeId}
                  onChange={(e) => setNoteTradeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded text-slate-900 cursor-pointer"
                >
                  <option value="">None (Unlinked)</option>
                  {symbolTrades.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      Trade #{t.id}: {t.buysell === 'B' ? 'BUY' : 'SELL'} {t.quantity} {t.symbol} @ $
                      {Number(t.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="note-status-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Thesis Status
                </label>
                <select
                  id="note-status-select"
                  aria-label="Thesis Status"
                  value={noteStatus}
                  onChange={(e) => setNoteStatus(e.target.value as ThesisStatusType)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded text-slate-900 cursor-pointer"
                >
                  <option value="In-Progress">In-Progress</option>
                  <option value="Validated">Validated</option>
                  <option value="Invalidated">Invalidated</option>
                </select>
              </div>
            </div>

            {/* Markdown Content Editor */}
            <div>
              <label
                htmlFor="note-markdown-textarea"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Core Thesis, Position Sizing Formula & Rationale (Markdown)
              </label>
              <textarea
                id="note-markdown-textarea"
                rows={8}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Document your investment thesis, entry/exit criteria, position sizing math, and post-trade review..."
                className="w-full p-3 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded leading-relaxed focus:outline-hidden focus:border-blue-600"
              />
            </div>

            {/* Referenced Agent Analyst Outputs (0..N Relational Links) */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Referenced Agent Analyst Outputs ({selectedOutputIds.length} Linked)
                </span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  data-testid="attach-analyst-outputs-btn"
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-blue-700 cursor-pointer flex items-center gap-1"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>+ Attach Analyst Outputs (0..N)</span>
                </button>
              </div>

              {linkedOutputObjects.length === 0 ? (
                <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                  0 analyst outputs linked. Click &quot;+ Attach Analyst Outputs (0..N)&quot; to
                  reference one or multiple Technical, Fundamental, Macro, Risk, or Executive
                  Summary records.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {linkedOutputObjects.map((out) => (
                    <div
                      key={out.id}
                      data-testid={`linked-output-card-${out.id}`}
                      className="p-2.5 rounded border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-slate-900">
                            Run #{out.run_id} {out.analyst_role.replace('_', ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleOutputSelection(out.id)}
                            aria-label={`Detach output ${out.id}`}
                            className="p-0.5 text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-semibold">
                            {out.directional_bias}
                          </span>
                          <span className="text-[10px] font-mono text-slate-600">
                            {out.trend_status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 line-clamp-2">
                          {out.summary_headline}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingOutput(out)}
                        className="text-left text-[10px] font-semibold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View Full Output</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save / Delete Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {selectedNoteId !== null ? (
              <button
                type="button"
                onClick={handleDeleteNote}
                className="px-3 py-1.5 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Note</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={saving}
              data-testid="save-note-btn"
              className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal 1: Attach 0..N Analyst Outputs Picker */}
      <ModalDialog
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Attach Analyst Outputs (0..N) — ${noteSymbol}`}
      >
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600">
              Select 0 to multiple stored outputs from the 4 analysts or Executive Summary:
            </span>
            <select
              aria-label="Filter outputs by role"
              value={pickerRoleFilter}
              onChange={(e) => setPickerRoleFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs font-mono bg-white"
            >
              <option value="All">All Roles</option>
              <option value="executive_summary">Executive Summary</option>
              <option value="technical">Technical Analyst</option>
              <option value="fundamental">Fundamental Analyst</option>
              <option value="macro">Macro Strategist</option>
              <option value="risk">Risk Manager</option>
            </select>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
            {modalFilteredOutputs.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No stored analyst outputs found for {noteSymbol}. Run the 4-Analyst Committee first.
              </div>
            ) : (
              modalFilteredOutputs.map((out) => {
                const checked = selectedOutputIds.includes(out.id);
                return (
                  <label
                    key={out.id}
                    className="p-2.5 flex items-start gap-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOutputSelection(out.id)}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          Output #{out.id} • Run #{out.run_id} ({out.analyst_role.replace('_', ' ')})
                        </span>
                        <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                          {out.directional_bias} ({out.confidence_score}%) • {out.trend_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{out.summary_headline}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-mono text-[11px] text-slate-600">
              {selectedOutputIds.length} output(s) selected
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="px-3 py-1.5 rounded bg-blue-700 text-white font-semibold text-xs cursor-pointer flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* Modal 2: Full Analyst Output Inspector */}
      <ModalDialog
        isOpen={Boolean(inspectingOutput)}
        onClose={() => setInspectingOutput(null)}
        title={
          inspectingOutput
            ? `Output #${inspectingOutput.id} — ${inspectingOutput.symbol} (${inspectingOutput.analyst_role.replace('_', ' ')})`
            : 'Analyst Output'
        }
      >
        {inspectingOutput && (
          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 font-semibold text-slate-900">
              {inspectingOutput.summary_headline}
            </div>
            <div className="max-h-80 overflow-y-auto pr-1">
              <RichMarkdown content={inspectingOutput.markdown_output} />
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
};

export default InvestmentNotesView;
