import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { ModalDialog } from '../../design-system';
import apiClient from '../../services/apiClient';
import { WatchlistEnrichedItem } from '../../types/api';

export interface WatchlistViewProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ onSelectSymbol }) => {
  const [items, setItems] = useState<WatchlistEnrichedItem[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newListCategory, setNewListCategory] = useState<string>('Watchlist');
  const [customListCategory, setCustomListCategory] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedLists] = await Promise.all([
        apiClient.getWatchlistItems(selectedList === 'All' ? undefined : selectedList),
        apiClient.getWatchlistLists().catch(() => ['Holding', 'Index', 'Watchlist']),
      ]);
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
      setModalOpen(false);
      loadWatchlist();
    } catch (err) {
      alert(`Failed to add ticker to watchlist: ${err}`);
    }
  };

  const handleRemoveTicker = async (symbol: string, watchlistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove ${symbol} from ${watchlistName}?`)) return;
    try {
      await apiClient.removeWatchlistItem(symbol, watchlistName);
      loadWatchlist();
    } catch (err) {
      alert(`Failed to remove ticker: ${err}`);
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      i.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-4">
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
            onClick={() => setModalOpen(true)}
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
            {selectedList === 'All' ? filteredItems.length : items.length}
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
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No matching symbols found in watchlist.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
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
                          onClick={(e) => handleRemoveTicker(item.symbol, item.watchlistname || 'Watchlist', e)}
                          className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title={`Remove ${item.symbol}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Adding Symbol */}
      <ModalDialog
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Symbol to Watchlist"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
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
    </div>
  );
};

export default WatchlistView;
