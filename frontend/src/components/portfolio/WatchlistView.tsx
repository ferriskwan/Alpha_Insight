import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { ModalDialog } from '../../design-system';
import apiClient from '../../services/apiClient';
import { PositionRecord, WatchlistEnrichedItem } from '../../types/api';

export interface WatchlistViewProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ onSelectSymbol }) => {
  const [items, setItems] = useState<WatchlistEnrichedItem[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<string>('All');
  const [openPositionSymbols, setOpenPositionSymbols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);

  // Add Modal State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newListCategory, setNewListCategory] = useState<string>('Watchlist');
  const [customListCategory, setCustomListCategory] = useState<string>('');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WatchlistEnrichedItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Watchlist');
  const [customEditCategory, setCustomEditCategory] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedLists, fetchedPositions] = await Promise.all([
        apiClient.getWatchlistItems(selectedList === 'All' ? undefined : selectedList),
        apiClient.getWatchlistLists().catch(() => ['Holding', 'Index', 'Watchlist']),
        apiClient.getPositions().catch(() => [] as PositionRecord[]),
      ]);

      const openSet = new Set<string>();
      for (const p of fetchedPositions || []) {
        if (p.symbol && Math.abs(Number(p.quantity || 0)) > 0) {
          openSet.add(p.symbol.trim().toUpperCase());
        }
      }
      setOpenPositionSymbols(openSet);
      setItems(fetchedItems || []);
      if (fetchedLists && fetchedLists.length > 0) {
        setLists(fetchedLists);
      }
    } catch (err) {
      console.error('Failed to load watchlist items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlist();
  }, [selectedList]);

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const targetCategory =
      newListCategory === '__custom__'
        ? customListCategory.trim() || 'Watchlist'
        : newListCategory;
    try {
      await apiClient.addWatchlistItem({
        symbol: newSymbol.trim().toUpperCase(),
        name: newName.trim() || newSymbol.trim().toUpperCase(),
        watchlistname: targetCategory,
      });
      setNewSymbol('');
      setNewName('');
      setCustomListCategory('');
      setAddModalOpen(false);
      loadWatchlist();
    } catch (err) {
      alert(`Failed to add ticker to watchlist: ${err}`);
    }
  };

  const handleOpenEdit = (item: WatchlistEnrichedItem) => {
    setEditingItem(item);
    setEditName(item.name || item.symbol);
    const existingGroup = item.watchlistname || 'Watchlist';
    if (lists.includes(existingGroup)) {
      setEditCategory(existingGroup);
      setCustomEditCategory('');
    } else {
      setEditCategory('__custom__');
      setCustomEditCategory(existingGroup);
    }
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingItem) return;

    const targetCategory =
      editCategory === '__custom__'
        ? customEditCategory.trim() || 'Watchlist'
        : editCategory;

    setSavingEdit(true);
    try {
      await apiClient.updateWatchlistItem(editingItem.symbol, {
        name: editName.trim() || editingItem.symbol,
        watchlistname: targetCategory,
        original_watchlistname: editingItem.watchlistname || 'Default',
      });
      setEditModalOpen(false);
      setEditingItem(null);
      loadWatchlist();
    } catch (err) {
      alert(`Failed to update watchlist item: ${err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteFromEdit = async () => {
    if (!editingItem) return;
    const sym = editingItem.symbol;
    const group = editingItem.watchlistname || 'Watchlist';
    if (!confirm(`Are you sure you want to remove ${sym} from ${group}?`)) {
      return;
    }
    try {
      await apiClient.removeWatchlistItem(sym, group);
      setEditModalOpen(false);
      setEditingItem(null);
      loadWatchlist();
    } catch (err) {
      alert(`Failed to delete ticker: ${err}`);
    }
  };

  // Helper to distinguish indexes
  const isIndexWatchlistItem = (item: WatchlistEnrichedItem): boolean => {
    const sym = (item.symbol || '').trim().toUpperCase();
    const wlName = (item.watchlistname || '').trim().toLowerCase();
    return sym.startsWith('^') || wlName.includes('index');
  };

  const filteredItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
        i.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [items, searchFilter]);

  // Grouping and 3-Tier Sort Logic:
  // 1. My Positions (open holdings)
  // 2. Other Stocks
  // 3. Indexes
  // Secondary sort: ascending alphabetical by symbol name
  const groupedSections = useMemo(() => {
    const bySymAsc = (a: WatchlistEnrichedItem, b: WatchlistEnrichedItem) =>
      (a.symbol || '').localeCompare(b.symbol || '');

    if (selectedList === 'All') {
      const positions = filteredItems
        .filter((w) => !isIndexWatchlistItem(w) && openPositionSymbols.has(w.symbol.trim().toUpperCase()))
        .sort(bySymAsc);
      const otherStocks = filteredItems
        .filter((w) => !isIndexWatchlistItem(w) && !openPositionSymbols.has(w.symbol.trim().toUpperCase()))
        .sort(bySymAsc);
      const indexes = filteredItems
        .filter((w) => isIndexWatchlistItem(w))
        .sort(bySymAsc);

      return [
        { id: 'positions', title: 'My Positions', count: positions.length, items: positions },
        { id: 'other', title: 'Other Stocks', count: otherStocks.length, items: otherStocks },
        { id: 'indexes', title: 'Indexes', count: indexes.length, items: indexes },
      ].filter((sec) => sec.items.length > 0);
    } else {
      return [
        {
          id: selectedList,
          title: selectedList,
          count: filteredItems.length,
          items: [...filteredItems].sort(bySymAsc),
        },
      ];
    }
  }, [filteredItems, selectedList, openPositionSymbols]);

  const totalFilteredCount = filteredItems.length;

  return (
    <div className="space-y-4" data-testid="watchlist-view">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-700" />
            Watchlist
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden w-44 sm:w-56"
            />
          </div>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Symbol</span>
          </button>

          <button
            type="button"
            onClick={loadWatchlist}
            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh Quotes"
            aria-label="Refresh Quotes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedList('All')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            selectedList === 'All'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>All Watchlists</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedList === 'All' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {selectedList === 'All' ? totalFilteredCount : items.length}
          </span>
        </button>
        {lists.map((listName) => (
          <button
            key={listName}
            type="button"
            onClick={() => setSelectedList(listName)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedList === listName
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>{listName}</span>
          </button>
        ))}
      </div>

      {/* Watchlist Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800 border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">Group</th>
                <th className="py-2.5 px-4">Company Name</th>
                <th className="py-2.5 px-4 text-right">Last Price</th>
                <th className="py-2.5 px-4 text-right">Day Change</th>
                <th className="py-2.5 px-4 text-right">% Change</th>
                <th className="py-2.5 px-4 text-right">Day Range</th>
                <th className="py-2.5 px-4 text-right">52-Week Range</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {groupedSections.length === 0 || totalFilteredCount === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No matching symbols found in watchlist.
                  </td>
                </tr>
              ) : (
                groupedSections.map((section) => (
                  <React.Fragment key={section.id}>
                    {/* Section Header (rendered in 'All' view to visibly group the tiers) */}
                    {selectedList === 'All' && (
                      <tr className="bg-slate-100/80 border-y border-slate-200 font-sans">
                        <td colSpan={10} className="py-2 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <span>{section.title}</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-600">
                              {section.count}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {section.items.map((item) => {
                      const isPositive = item.change >= 0;
                      return (
                        <tr
                          key={`${item.watchlistname}-${item.symbol}`}
                          onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="group-hover:text-blue-700 transition-colors">{item.symbol}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.watchlistname || 'Watchlist'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-sans">{item.name}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ${(item.lastPrice ?? 0).toFixed(2)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              isPositive ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isPositive ? '+' : ''}${(item.change ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                                isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {isPositive ? '+' : ''}{(item.changePct ?? 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 text-[11px]">
                            ${(item.dayLow ?? 0).toFixed(2)} - ${(item.dayHigh ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 text-[11px]">
                            ${(item.low52 ?? 0).toFixed(2)} - ${(item.high52 ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            {(item.volume ?? 0) > 0 ? ((item.volume ?? 0) / 1000000).toFixed(2) + 'M' : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(item);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              title={`Edit ${item.symbol}`}
                              aria-label={`Edit ${item.symbol}`}
                              data-testid={`edit-watchlist-${item.symbol}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Adding Symbol */}
      <ModalDialog
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Symbol to Watchlist"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTicker}
              className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
            >
              Add Symbol
            </button>
          </div>
        }
      >
        <form onSubmit={handleAddTicker} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ticker Symbol</label>
            <input
              type="text"
              required
              placeholder="e.g. MSFT, NVDA, TSLA"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold uppercase focus:ring-1 focus:ring-blue-700 outline-hidden"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Company / Display Name</label>
            <input
              type="text"
              placeholder="e.g. Microsoft Corporation"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Watchlist Group</label>
            <select
              value={newListCategory}
              onChange={(e) => setNewListCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs text-slate-800 focus:ring-1 focus:ring-blue-700 outline-hidden"
            >
              {lists.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value="__custom__">+ Create New Watchlist Group...</option>
            </select>
            {newListCategory === '__custom__' && (
              <input
                type="text"
                placeholder="Enter new group name..."
                value={customListCategory}
                onChange={(e) => setCustomListCategory(e.target.value)}
                className="mt-2 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            )}
          </div>
        </form>
      </ModalDialog>

      {/* Modal Dialog for Editing Symbol & In-Modal Deletion */}
      <ModalDialog
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Watchlist Item — ${editingItem?.symbol || ''}`}
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleDeleteFromEdit}
              className="px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              data-testid="delete-watchlist-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Symbol</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                data-testid="save-watchlist-edit-btn"
              >
                Save Changes
              </button>
            </div>
          </div>
        }
      >
        {editingItem && (
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ticker Symbol</label>
              <input
                type="text"
                disabled
                readOnly
                value={editingItem.symbol}
                className="w-full px-3 py-1.5 border border-slate-200 rounded font-mono font-bold uppercase bg-slate-100 text-slate-500 cursor-not-allowed outline-hidden"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Ticker symbol cannot be changed to preserve quote history.</p>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company / Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Corning Incorporated"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Watchlist Group</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs text-slate-800 focus:ring-1 focus:ring-blue-700 outline-hidden"
              >
                {lists.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                <option value="__custom__">+ Create New Watchlist Group...</option>
              </select>
              {editCategory === '__custom__' && (
                <input
                  type="text"
                  placeholder="Enter new group name..."
                  value={customEditCategory}
                  onChange={(e) => setCustomEditCategory(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              )}
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};

export default WatchlistView;
