import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsUpDown,
  Layers,
  List,
  GripVertical,
  X,
  RotateCcw,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ModalDialog } from '../../design-system';
import apiClient from '../../services/apiClient';
import { TradeRecord, CapitalRecord, TransCostItem, PositionRecord, WatchlistEnrichedItem } from '../../types/api';
import { formatTradeDate } from '../../lib/dateFormatter';
import {
  getCurrencyBadgeClasses,
  getCurrencyPrefix,
  inferSymbolCurrency,
} from '../../lib/currency';

export type GroupByField = 'tradedate' | 'symbol' | 'side' | 'account';
export type GroupByOption = 'none' | GroupByField;
export type ViewMode = 'group' | 'list';
export type SortColumn =
  | 'tradedate'
  | 'symbol'
  | 'side'
  | 'account'
  | 'price'
  | 'quantity'
  | 'consideration'
  | 'remarks';
export type SortDirection = 'asc' | 'desc';

export const GROUP_FIELD_LABELS: Record<GroupByField, string> = {
  tradedate: 'Trade Date',
  symbol: 'Symbol',
  side: 'Side',
  account: 'Account',
};

export const ALL_GROUP_FIELDS: GroupByField[] = ['tradedate', 'symbol', 'side', 'account'];

export interface TradeGroup {
  key: string;
  label: string;
  trades: TradeRecord[];
  buyQty: number;
  sellQty: number;
  buyConsideration: number;
  sellConsideration: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  balanceShares: number;
  realizedPnL: number;
  unrealizedPnL: number;
  // Legacy compatibility fields
  totalQty: number;
  totalConsideration: number;
  avgPrice: number;
}

export interface TransactionsViewProps {
  initialTab?: 'trades' | 'capital' | 'costs';
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ initialTab = 'trades' }) => {
  const [activeTab, setActiveTab] = useState<'trades' | 'capital' | 'costs'>(initialTab);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [capital, setCapital] = useState<CapitalRecord[]>([]);
  const [costs, setCosts] = useState<TransCostItem[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEnrichedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Grouping state: defaults to grouping by 'tradedate' per requirements
  const [groupByKeys, setGroupByKeys] = useState<GroupByField[]>(['tradedate']);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // View mode state: Grouped vs List
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('alpha_insight_transactions_view_mode') as ViewMode) || 'group';
    } catch {
      return 'group';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_transactions_view_mode', viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Column sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  // Edit Trade form state
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editSymbol, setEditSymbol] = useState<string>('');
  const [editBuysell, setEditBuysell] = useState<'B' | 'S'>('B');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editTradeDate, setEditTradeDate] = useState<string>('');
  const [editTradeRemarks, setEditTradeRemarks] = useState<string>('');
  const [editInvestment, setEditInvestment] = useState<boolean>(true);

  // Edit Capital form state
  const [editingCapital, setEditingCapital] = useState<CapitalRecord | null>(null);
  const [editCapTransType, setEditCapTransType] = useState<'D' | 'W'>('D');
  const [editCapBroker, setEditCapBroker] = useState<string>('Saxo');
  const [editCapAccountType, setEditCapAccountType] = useState<string>('Margin');
  const [editCapAmount, setEditCapAmount] = useState<number>(0);
  const [editCapCurrency, setEditCapCurrency] = useState<string>('SGD');
  const [editCapDate, setEditCapDate] = useState<string>('');
  const [editCapRemarks, setEditCapRemarks] = useState<string>('');

  // Edit Cost form state
  const [editingCost, setEditingCost] = useState<TransCostItem | null>(null);
  const [editCostType, setEditCostType] = useState<string>('commission');
  const [editCostAmount, setEditCostAmount] = useState<number>(0);
  const [editCostCurrency, setEditCostCurrency] = useState<string>('SGD');
  const [editCostDate, setEditCostDate] = useState<string>('');
  const [editCostTradeId, setEditCostTradeId] = useState<string>('');
  const [editCostRemarks, setEditCostRemarks] = useState<string>('');

  // Drag and drop state for interactive column reordering
  const dragSourceRef = React.useRef<GroupByField | null>(null);
  const [draggedKey, setDraggedKey] = useState<GroupByField | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    key: GroupByField;
    position: 'before' | 'after';
  } | null>(null);

  // Modal Dialog state
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Trade form state
  const [symbol, setSymbol] = useState<string>('');
  const [buysell, setBuysell] = useState<'B' | 'S'>('B');
  const [price, setPrice] = useState<number>(185.0);
  const [quantity, setQuantity] = useState<number>(100);
  const [tradeDate, setTradeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tradeRemarks, setTradeRemarks] = useState<string>('');

  // Capital form state
  const [capBroker, setCapBroker] = useState<string>('Saxo');
  const [capTransType, setCapTransType] = useState<'D' | 'W'>('D');
  const [capAccountType, setCapAccountType] = useState<string>('Cash');
  const [capAmount, setCapAmount] = useState<number>(10000);
  const [capCurrency, setCapCurrency] = useState<string>('USD');
  const [capDate, setCapDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [capRemarks, setCapRemarks] = useState<string>('Capital injection');

  // Trans Cost form state
  const [costType, setCostType] = useState<string>('commission');
  const [costAmount, setCostAmount] = useState<number>(2.50);
  const [costCurrency, setCostCurrency] = useState<string>('USD');
  const [costDate, setCostDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [costTradeId, setCostTradeId] = useState<string>('');
  const [costRemarks, setCostRemarks] = useState<string>('Execution commission');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tradeList, capitalList, costList, positionList, watchlistList] = await Promise.all([
        apiClient.getTrades(),
        apiClient.getCapital(),
        apiClient.getTransCosts(),
        apiClient.getPositions().catch(() => [] as PositionRecord[]),
        apiClient.getWatchlistItems().catch(() => [] as WatchlistEnrichedItem[]),
      ]);
      setTrades(tradeList || []);
      setCapital(capitalList || []);
      setCosts(costList || []);
      setPositions(positionList || []);
      setWatchlist(watchlistList || []);
    } catch (err) {
      console.error('Failed to load transaction book:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const watchlistSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const item of watchlist) {
      if (item.symbol && item.symbol.trim()) {
        set.add(item.symbol.trim().toUpperCase());
      }
    }
    return Array.from(set).sort();
  }, [watchlist]);

  useEffect(() => {
    if (watchlistSymbols.length > 0) {
      if (!symbol || !watchlistSymbols.includes(symbol)) {
        setSymbol(watchlistSymbols[0]);
      }
    } else {
      setSymbol('');
    }
  }, [watchlistSymbols, symbol]);

  // Symbol to latest price map for Unrealized PnL valuation
  const symbolPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      const prc = Number(p.eodprice);
      if (p.symbol && !isNaN(prc) && prc > 0) {
        map.set(p.symbol.trim().toUpperCase(), prc);
      }
    }
    // Fallback to most recent trade price if unquoted in positions
    for (const t of trades) {
      const sym = (t.symbol || '').trim().toUpperCase();
      const prc = Number(t.price);
      if (sym && !map.has(sym) && !isNaN(prc) && prc > 0) {
        map.set(sym, prc);
      }
    }
    return map;
  }, [positions, trades]);

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedRemarks = tradeRemarks.trim();
    if (!trimmedSymbol) {
      alert('Please select a valid ticker symbol from your watchlist.');
      return;
    }
    if (!watchlistSymbols.includes(trimmedSymbol)) {
      alert(`Symbol "${trimmedSymbol}" is not in your watchlist. A symbol must be in your watchlist before creating a trade.`);
      return;
    }
    if (!trimmedRemarks) {
      alert('Execution remarks are required.');
      return;
    }
    try {
      await apiClient.createTrade({
        symbol: trimmedSymbol,
        buysell,
        price,
        quantity,
        tradedate: tradeDate,
        investment: true,
        remarks: trimmedRemarks,
      });
      setModalOpen(false);
      setTradeRemarks('');
      loadAll();
    } catch (err) {
      alert(`Failed to execute trade: ${err}`);
    }
  };

  const handleOpenEditModal = (t: TradeRecord) => {
    setEditingTrade(t);
    setEditSymbol(t.symbol);
    setEditBuysell((t.buysell === 'S' ? 'S' : 'B') as 'B' | 'S');
    setEditPrice(Number(t.price) || 0);
    setEditQuantity(Number(t.quantity) || 0);
    setEditTradeDate(t.tradedate ? t.tradedate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditTradeRemarks(t.remarks || '');
    setEditInvestment(t.investment !== false);
  };

  const handleUpdateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade || !editingTrade.id) return;
    const trimmedSymbol = editSymbol.trim().toUpperCase();
    const trimmedRemarks = editTradeRemarks.trim();
    if (!trimmedSymbol) {
      alert('Please select a valid ticker symbol.');
      return;
    }
    if (!trimmedRemarks) {
      alert('Execution remarks are required.');
      return;
    }
    try {
      await apiClient.updateTransaction('trade', {
        id: editingTrade.id,
        symbol: trimmedSymbol,
        buysell: editBuysell,
        price: editPrice,
        quantity: editQuantity,
        tradedate: editTradeDate,
        investment: editInvestment,
        remarks: trimmedRemarks,
      });
      setEditingTrade(null);
      loadAll();
    } catch (err) {
      alert(`Failed to update trade: ${err}`);
    }
  };

  const handleDeleteTrade = async (t: TradeRecord) => {
    if (!t.id) return;
    const direction = String(t.buysell).toUpperCase() === 'B' ? 'BUY' : 'SELL';
    if (!confirm(`Are you sure you want to delete this trade: ${t.symbol} (${direction} ${t.quantity} @ $${t.price})?`)) {
      return;
    }
    try {
      await apiClient.deleteTransaction('trade', { id: t.id });
      loadAll();
    } catch (err) {
      alert(`Failed to delete trade: ${err}`);
    }
  };

  const handleOpenEditCapitalModal = (c: CapitalRecord) => {
    setEditingCapital(c);
    setEditCapTransType((String(c.transtype).toUpperCase() === 'W' ? 'W' : 'D') as 'D' | 'W');
    setEditCapBroker(c.broker || 'Saxo');
    setEditCapAccountType(
      c.accounttype === 'M' || c.accounttype === 'Margin'
        ? 'Margin'
        : c.accounttype === 'L' || c.accounttype === 'Leverage'
        ? 'Leverage'
        : 'Cash'
    );
    setEditCapAmount(Math.abs(Number(c.amount) || 0));
    setEditCapCurrency(c.currency || 'SGD');
    setEditCapDate(c.date ? c.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditCapRemarks(c.remarks || '');
  };

  const handleUpdateCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCapital || !editingCapital.id) return;
    const trimmedBroker = editCapBroker.trim();
    const trimmedRemarks = editCapRemarks.trim();
    if (!trimmedBroker) {
      alert('Broker is required.');
      return;
    }
    if (!trimmedRemarks) {
      alert('Execution remarks are required.');
      return;
    }
    try {
      await apiClient.updateTransaction('capital', {
        id: editingCapital.id,
        transtype: editCapTransType,
        broker: trimmedBroker,
        accounttype: editCapAccountType,
        amount: editCapAmount,
        currency: editCapCurrency,
        date: editCapDate,
        remarks: trimmedRemarks,
      });
      setEditingCapital(null);
      loadAll();
    } catch (err) {
      alert(`Failed to update capital record: ${err}`);
    }
  };

  const handleDeleteCapital = async (c: CapitalRecord) => {
    if (!c.id) return;
    const typeStr = String(c.transtype).toUpperCase() === 'D' ? 'DEPOSIT' : 'WITHDRAWAL';
    if (!confirm(`Are you sure you want to delete this capital entry: ${typeStr} $${Math.abs(c.amount || 0).toLocaleString()} (${c.broker})?`)) {
      return;
    }
    try {
      await apiClient.deleteTransaction('capital', { id: c.id });
      loadAll();
    } catch (err) {
      alert(`Failed to delete capital record: ${err}`);
    }
  };

  const handleOpenEditCostModal = (co: TransCostItem) => {
    setEditingCost(co);
    setEditCostType(co.cost_type || 'commission');
    setEditCostAmount(Number(co.amount) || 0);
    setEditCostCurrency(co.currency || 'SGD');
    setEditCostDate(co.date ? co.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditCostTradeId(co.trade_id ? String(co.trade_id) : '');
    setEditCostRemarks(co.remarks || '');
  };

  const handleUpdateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCost || !editingCost.id) return;
    const trimmedRemarks = editCostRemarks.trim();
    if (!trimmedRemarks) {
      alert('Remarks are required.');
      return;
    }
    try {
      await apiClient.updateTransCost(editingCost.id, {
        cost_type: editCostType,
        amount: editCostAmount,
        currency: editCostCurrency,
        date: editCostDate,
        trade_id: editCostTradeId ? parseInt(editCostTradeId, 10) : undefined,
        remarks: trimmedRemarks,
      });
      setEditingCost(null);
      loadAll();
    } catch (err) {
      alert(`Failed to update transaction cost: ${err}`);
    }
  };

  const handleDeleteCost = async (co: TransCostItem) => {
    if (!co.id) return;
    if (!confirm(`Are you sure you want to delete this cost entry: ${co.cost_type} -$${co.amount.toFixed(2)} (${co.currency})?`)) {
      return;
    }
    try {
      await apiClient.deleteTransCost(co.id);
      loadAll();
    } catch (err) {
      alert(`Failed to delete transaction cost: ${err}`);
    }
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn !== col) {
      setSortColumn(col);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  const compareTrades = (a: TradeRecord, b: TradeRecord, col: SortColumn, dir: SortDirection): number => {
    let cmp = 0;
    if (col === 'tradedate') {
      const timeA = new Date(a.tradedate).getTime() || 0;
      const timeB = new Date(b.tradedate).getTime() || 0;
      cmp = timeA - timeB;
    } else if (col === 'symbol') {
      cmp = (a.symbol || '').localeCompare(b.symbol || '');
    } else if (col === 'side') {
      cmp = (a.buysell || '').localeCompare(b.buysell || '');
    } else if (col === 'account') {
      const accA = a.investment ? 'Investment' : 'Leverage';
      const accB = b.investment ? 'Investment' : 'Leverage';
      cmp = accA.localeCompare(accB);
    } else if (col === 'price') {
      cmp = (Number(a.price) || 0) - (Number(b.price) || 0);
    } else if (col === 'quantity') {
      cmp = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
    } else if (col === 'consideration') {
      const cA = (Number(a.price) || 0) * (Number(a.quantity) || 0);
      const cB = (Number(b.price) || 0) * (Number(b.quantity) || 0);
      cmp = cA - cB;
    } else if (col === 'remarks') {
      cmp = (a.remarks || '').localeCompare(b.remarks || '');
    }
    return dir === 'asc' ? cmp : -cmp;
  };

  const handleAdjustCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createCapital({
        broker: capBroker.trim(),
        transtype: capTransType,
        accounttype: capAccountType,
        amount: capAmount,
        currency: capCurrency.trim().toUpperCase(),
        date: capDate,
        remarks: capRemarks,
      });
      setModalOpen(false);
      loadAll();
    } catch (err) {
      alert(`Failed to adjust capital: ${err}`);
    }
  };

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createTransCost({
        cost_type: costType,
        amount: costAmount,
        currency: costCurrency.trim().toUpperCase(),
        date: costDate,
        trade_id: costTradeId ? parseInt(costTradeId) : undefined,
        remarks: costRemarks,
      });
      setModalOpen(false);
      loadAll();
    } catch (err) {
      alert(`Failed to record transaction cost: ${err}`);
    }
  };

  const getActionBtnLabel = () => {
    if (activeTab === 'trades') return 'New trade';
    if (activeTab === 'capital') return 'Adjust capital';
    return 'New cost';
  };

  const getModalTitle = () => {
    if (activeTab === 'trades') return 'New Trade Order Ticket';
    if (activeTab === 'capital') return 'Adjust Capital';
    return 'Record Transaction Cost';
  };

  // Drag and drop handlers for column chips
  const handleDragStart = (key: GroupByField, e: React.DragEvent) => {
    dragSourceRef.current = key;
    setDraggedKey(key);
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleChipDragOver = (targetKey: GroupByField, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX < rect.left + rect.width / 2;
    setDropIndicator({ key: targetKey, position: isLeftHalf ? 'before' : 'after' });
  };

  const handleChipDrop = (targetKey: GroupByField, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceKey = dragSourceRef.current || (e.dataTransfer.getData('text/plain') as GroupByField);
    if (!sourceKey || !ALL_GROUP_FIELDS.includes(sourceKey) || sourceKey === targetKey) {
      setDraggedKey(null);
      setDropIndicator(null);
      dragSourceRef.current = null;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const insertBefore = e.clientX < rect.left + rect.width / 2;

    const current = groupByKeys.filter((k) => k !== sourceKey);
    const targetIdx = current.indexOf(targetKey);
    if (targetIdx === -1) {
      current.push(sourceKey);
    } else {
      current.splice(insertBefore ? targetIdx : targetIdx + 1, 0, sourceKey);
    }

    setGroupByKeys(current);
    setCollapsedGroups({});
    setDraggedKey(null);
    setDropIndicator(null);
    dragSourceRef.current = null;
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceKey = dragSourceRef.current || (e.dataTransfer.getData('text/plain') as GroupByField);
    if (!sourceKey || !ALL_GROUP_FIELDS.includes(sourceKey)) {
      setDraggedKey(null);
      setDropIndicator(null);
      dragSourceRef.current = null;
      return;
    }

    // Append to end if dropped onto container
    const current = groupByKeys.filter((k) => k !== sourceKey);
    current.push(sourceKey);
    setGroupByKeys(current);
    setCollapsedGroups({});
    setDraggedKey(null);
    setDropIndicator(null);
    dragSourceRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDropIndicator(null);
    dragSourceRef.current = null;
  };

  const moveKey = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= groupByKeys.length) return;
    const next = [...groupByKeys];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    setGroupByKeys(next);
    setCollapsedGroups({});
  };

  const removeGroupKey = (key: GroupByField) => {
    setGroupByKeys((prev) => prev.filter((k) => k !== key));
    setCollapsedGroups({});
  };

  const addGroupKey = (key: GroupByField) => {
    if (!groupByKeys.includes(key)) {
      setGroupByKeys((prev) => [...prev, key]);
      setCollapsedGroups({});
    }
  };

  const resetToDefault = () => {
    setGroupByKeys(['tradedate']);
    setCollapsedGroups({});
  };

  const availableKeys = ALL_GROUP_FIELDS.filter((k) => !groupByKeys.includes(k));

  // Dynamic metadata column ordering reflecting the active Group By sequence
  const activeMetadataCols = useMemo<GroupByField[]>(() => {
    if (viewMode === 'list') {
      return ['tradedate', 'symbol', 'account'];
    }
    const leading: GroupByField[] = [];
    // Prioritize active group by keys in their exact ordering
    for (const k of groupByKeys) {
      if (!leading.includes(k)) {
        leading.push(k);
      }
    }
    // Append remaining base metadata columns not included in grouping
    const defaultMeta: GroupByField[] = ['tradedate', 'symbol', 'account'];
    for (const k of defaultMeta) {
      if (!leading.includes(k)) {
        leading.push(k);
      }
    }
    return leading;
  }, [groupByKeys, viewMode]);

  const renderMetadataCell = (col: GroupByField, t: TradeRecord, isDetail = false, isFirstCol = false) => {
    switch (col) {
      case 'tradedate':
        return (
          <td
            key="tradedate"
            className={`py-2 px-3 text-slate-600 ${isFirstCol && isDetail ? 'pl-6' : ''}`}
          >
            {formatTradeDate(t.tradedate)}
          </td>
        );
      case 'symbol':
        return (
          <td
            key="symbol"
            className={`py-2 px-3 font-bold text-slate-900 ${isFirstCol && isDetail ? 'pl-6' : ''}`}
          >
            {t.symbol}
          </td>
        );
      case 'account':
        return (
          <td
            key="account"
            className={`py-2 px-3 text-slate-600 font-sans ${isFirstCol && isDetail ? 'pl-6' : ''}`}
          >
            {t.investment ? 'Investment' : 'Leverage'}
          </td>
        );
      case 'side': {
        const isBuy = String(t.buysell).toUpperCase() === 'B';
        return (
          <td
            key="side"
            className={`py-2 px-3 ${isFirstCol && isDetail ? 'pl-6' : ''}`}
          >
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isBuy ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isBuy ? 'BUY' : 'SELL'}
            </span>
          </td>
        );
      }
    }
  };

  // Multi-column grouping and sub-aggregation calculation engine
  const tradeGroups = useMemo<TradeGroup[]>(() => {
    if (groupByKeys.length === 0) return [];

    const map = new Map<string, { label: string; trades: TradeRecord[] }>();

    for (const t of trades) {
      const parts: string[] = [];
      for (const key of groupByKeys) {
        if (key === 'tradedate') {
          parts.push(formatTradeDate(t.tradedate));
        } else if (key === 'symbol') {
          parts.push((t.symbol || 'UNKNOWN').toUpperCase());
        } else if (key === 'side') {
          parts.push(String(t.buysell).toUpperCase() === 'B' ? 'BUY' : 'SELL');
        } else if (key === 'account') {
          parts.push(t.investment ? 'Investment' : 'Leverage');
        }
      }
      const groupKey = parts.join(' › ');

      let entry = map.get(groupKey);
      if (!entry) {
        entry = { label: groupKey, trades: [] };
        map.set(groupKey, entry);
      }
      entry.trades.push(t);
    }

    const groups: TradeGroup[] = [];

    map.forEach((entry, key) => {
      let buyQty = 0;
      let sellQty = 0;
      let buyConsideration = 0;
      let sellConsideration = 0;

      // Group trades by symbol to accurately calculate PnL across mixed-symbol groups
      const symbolBreakdown = new Map<
        string,
        { buyQty: number; sellQty: number; buyCost: number; sellCost: number }
      >();

      for (const t of entry.trades) {
        const isBuy = String(t.buysell).toUpperCase() === 'B';
        const qty = Number(t.quantity || 0);
        const prc = Number(t.price || 0);
        const cost = qty * prc;
        const sym = (t.symbol || 'UNKNOWN').trim().toUpperCase();

        let sData = symbolBreakdown.get(sym);
        if (!sData) {
          sData = { buyQty: 0, sellQty: 0, buyCost: 0, sellCost: 0 };
          symbolBreakdown.set(sym, sData);
        }

        if (isBuy) {
          buyQty += qty;
          buyConsideration += cost;
          sData.buyQty += qty;
          sData.buyCost += cost;
        } else {
          sellQty += qty;
          sellConsideration += cost;
          sData.sellQty += qty;
          sData.sellCost += cost;
        }
      }

      const avgBuyPrice = buyQty > 0 ? buyConsideration / buyQty : 0;
      const avgSellPrice = sellQty > 0 ? sellConsideration / sellQty : 0;
      const balanceShares = buyQty - sellQty;

      let realizedPnL = 0;
      let unrealizedPnL = 0;

      symbolBreakdown.forEach((sData, sym) => {
        const sAvgBuy = sData.buyQty > 0 ? sData.buyCost / sData.buyQty : 0;
        const sAvgSell = sData.sellQty > 0 ? sData.sellCost / sData.sellQty : 0;
        const sClosedQty = Math.min(sData.buyQty, sData.sellQty);

        if (sClosedQty > 0 && sAvgBuy > 0 && sAvgSell > 0) {
          realizedPnL += sClosedQty * (sAvgSell - sAvgBuy);
        }

        const sBal = sData.buyQty - sData.sellQty;
        const pMkt = symbolPriceMap.get(sym) ?? (sAvgBuy || sAvgSell || 0);

        if (sBal > 0 && sAvgBuy > 0) {
          // Long position: Bal * (P_mkt - P_avg_buy)
          unrealizedPnL += sBal * (pMkt - sAvgBuy);
        } else if (sBal < 0 && sAvgSell > 0) {
          // Short position: |Bal| * (P_avg_sell - P_mkt)
          unrealizedPnL += Math.abs(sBal) * (sAvgSell - pMkt);
        }
      });

      const totalQty = buyQty + sellQty;
      const totalConsideration = buyConsideration + sellConsideration;
      const avgPrice = totalQty > 0 ? totalConsideration / totalQty : 0;

      groups.push({
        key,
        label: entry.label,
        trades: entry.trades,
        buyQty,
        sellQty,
        buyConsideration,
        sellConsideration,
        avgBuyPrice,
        avgSellPrice,
        balanceShares,
        realizedPnL,
        unrealizedPnL,
        totalQty,
        totalConsideration,
        avgPrice,
      });
    });

    if (sortColumn && sortDirection) {
      // Sort trades within each group
      groups.forEach((g) => {
        g.trades.sort((a, b) => compareTrades(a, b, sortColumn, sortDirection));
      });
      // If sortColumn is the primary groupBy field, also sort the groups
      if (sortColumn === groupByKeys[0]) {
        groups.sort((a, b) => {
          const valA = a.label;
          const valB = b.label;
          const cmp = valA.localeCompare(valB, undefined, { numeric: true });
          return sortDirection === 'asc' ? cmp : -cmp;
        });
      }
    }

    return groups;
  }, [trades, groupByKeys, symbolPriceMap, sortColumn, sortDirection]);

  // Flat list sorted trades for List Mode
  const sortedTrades = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return trades;
    }
    return [...trades].sort((a, b) => compareTrades(a, b, sortColumn, sortDirection));
  }, [trades, sortColumn, sortDirection]);

  // Watchlist currency map for fallback
  const watchlistCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of watchlist) {
      if (w.symbol && w.currency) {
        map.set(w.symbol.trim().toUpperCase(), w.currency.trim().toUpperCase());
      }
    }
    return map;
  }, [watchlist]);

  const getTradeCurrency = (t: TradeRecord): string => {
    return inferSymbolCurrency(t.symbol, t.currency, watchlistCurrencyMap);
  };

  const getTradeFxRate = (t: TradeRecord): number => {
    if (t.fx_rate && t.fx_rate > 0) return t.fx_rate;
    return 1.0;
  };

  // Dynamic Multi-Currency Subtotals (alphabetical) & Consolidated USD Grand Total
  const multiCurrencySummaries = useMemo(() => {
    const calcSubtotal = (tradeList: TradeRecord[]) => {
      let totalBuyQty = 0;
      let totalSellQty = 0;
      let totalBuyConsideration = 0;
      let totalSellConsideration = 0;
      const symbolMap = new Map<
        string,
        { buyQty: number; sellQty: number; buyCost: number; sellCost: number }
      >();

      for (const t of tradeList) {
        const isBuy = String(t.buysell).toUpperCase() === 'B';
        const qty = Number(t.quantity || 0);
        const prc = Number(t.price || 0);
        const cost = qty * prc;
        const sym = (t.symbol || 'UNKNOWN').trim().toUpperCase();

        let s = symbolMap.get(sym);
        if (!s) {
          s = { buyQty: 0, sellQty: 0, buyCost: 0, sellCost: 0 };
          symbolMap.set(sym, s);
        }

        if (isBuy) {
          totalBuyQty += qty;
          totalBuyConsideration += cost;
          s.buyQty += qty;
          s.buyCost += cost;
        } else {
          totalSellQty += qty;
          totalSellConsideration += cost;
          s.sellQty += qty;
          s.sellCost += cost;
        }
      }

      const isSingleSymbol = symbolMap.size === 1;
      const avgBuyPrice = isSingleSymbol && totalBuyQty > 0 ? totalBuyConsideration / totalBuyQty : 0;
      const avgSellPrice = isSingleSymbol && totalSellQty > 0 ? totalSellConsideration / totalSellQty : 0;
      const netBalance = totalBuyQty - totalSellQty;

      let realizedPnL = 0;
      symbolMap.forEach((s) => {
        const sAvgBuy = s.buyQty > 0 ? s.buyCost / s.buyQty : 0;
        const sAvgSell = s.sellQty > 0 ? s.sellCost / s.sellQty : 0;
        const sClosedQty = Math.min(s.buyQty, s.sellQty);
        if (sClosedQty > 0 && sAvgBuy > 0 && sAvgSell > 0) {
          realizedPnL += sClosedQty * (sAvgSell - sAvgBuy);
        }
      });

      return {
        count: tradeList.length,
        totalBuyQty,
        totalSellQty,
        totalBuyConsideration,
        totalSellConsideration,
        avgBuyPrice,
        avgSellPrice,
        netBalance,
        realizedPnL,
      };
    };

    const byCurrency = new Map<string, TradeRecord[]>();
    for (const t of trades) {
      const ccy = getTradeCurrency(t);
      const list = byCurrency.get(ccy);
      if (list) {
        list.push(t);
      } else {
        byCurrency.set(ccy, [t]);
      }
    }

    const sortedCurrencies = Array.from(byCurrency.keys()).sort((a, b) => a.localeCompare(b));
    const currencies = sortedCurrencies.map((ccy) => {
      const list = byCurrency.get(ccy) || [];
      return {
        currency: ccy,
        trades: list,
        subtotal: calcSubtotal(list),
      };
    });

    // Consolidated in USD using each trade's previous-day fx_rate (max(date) < tradedate)
    let consolidatedBuyCostUSD = 0;
    let consolidatedSellCostUSD = 0;

    for (const t of trades) {
      const isBuy = String(t.buysell).toUpperCase() === 'B';
      const ccy = getTradeCurrency(t);
      const fx = getTradeFxRate(t);
      const cost = Number(t.quantity || 0) * Number(t.price || 0);
      const costUSD = ccy === 'USD' ? cost : cost / (fx || 1.0);

      if (isBuy) {
        consolidatedBuyCostUSD += costUSD;
      } else {
        consolidatedSellCostUSD += costUSD;
      }
    }

    // Dynamic per-currency Realized PnL consolidation into USD
    let consolidatedRealizedPnLUSD = 0;
    for (const entry of currencies) {
      if (entry.currency === 'USD') {
        consolidatedRealizedPnLUSD += entry.subtotal.realizedPnL;
      } else {
        const fxRates = entry.trades.map((t) => getTradeFxRate(t)).filter((r) => r > 0);
        const avgFx =
          fxRates.length > 0
            ? fxRates.reduce((acc, r) => acc + r, 0) / fxRates.length
            : 1.0;
        consolidatedRealizedPnLUSD += entry.subtotal.realizedPnL / (avgFx || 1.0);
      }
    }

    return {
      currencies,
      consolidated: {
        count: trades.length,
        totalBuyConsiderationUSD: consolidatedBuyCostUSD,
        totalSellConsiderationUSD: consolidatedSellCostUSD,
        realizedPnLUSD: consolidatedRealizedPnLUSD,
      },
    };
  }, [trades, watchlistCurrencyMap]);

  // Grand Total calculation for table footer (legacy compatibility)
  const grandTotal = useMemo(() => {
    return {
      count: multiCurrencySummaries.consolidated.count,
      totalBuyConsideration: multiCurrencySummaries.consolidated.totalBuyConsiderationUSD,
      totalSellConsideration: multiCurrencySummaries.consolidated.totalSellConsiderationUSD,
      totalRealizedPnL: multiCurrencySummaries.consolidated.realizedPnLUSD,
      totalConsideration:
        multiCurrencySummaries.consolidated.totalBuyConsiderationUSD +
        multiCurrencySummaries.consolidated.totalSellConsiderationUSD,
    };
  }, [multiCurrencySummaries]);

  const areAllCollapsed = useMemo(() => {
    if (tradeGroups.length === 0) return false;
    return tradeGroups.every((g) => !!collapsedGroups[g.key]);
  }, [tradeGroups, collapsedGroups]);

  // Aggregation metrics strip is only financially meaningful when grouped primarily by Symbol
  const isGroupedBySymbolFirst = useMemo(() => {
    return groupByKeys.length > 0 && groupByKeys[0] === 'symbol';
  }, [groupByKeys]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAllGroups = () => {
    if (areAllCollapsed) {
      setCollapsedGroups({});
    } else {
      const next: Record<string, boolean> = {};
      tradeGroups.forEach((g) => {
        next[g.key] = true;
      });
      setCollapsedGroups(next);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-700" />
            Transactions
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded border border-slate-300 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('trades')}
              className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
                activeTab === 'trades' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trades ({trades.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('capital')}
              className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
                activeTab === 'capital' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Capital ({capital.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('costs')}
              className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
                activeTab === 'costs' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Costs ({costs.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'trades') {
                setTradeRemarks('');
              }
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{getActionBtnLabel()}</span>
          </button>

          <button
            type="button"
            onClick={loadAll}
            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh Ledger"
            aria-label="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        {/* Trades Tab Content */}
        {activeTab === 'trades' && (
          <div>
            {/* Toolbar: View Mode Switch & Grouping Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                {/* View Mode Toggle Segmented Control (Circled Blue) */}
                <div className="inline-flex rounded-md border border-slate-300 bg-slate-200/60 p-0.5 text-xs font-semibold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('group')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      viewMode === 'group'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                    title="Grouped Mode"
                    aria-label="Grouped Mode"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Grouped</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                    title="List Mode (Flat Clean View)"
                    aria-label="List Mode"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List</span>
                  </button>
                </div>

                {viewMode === 'group' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                      <span>Group By:</span>
                    </div>

                    {/* Drop Zone / Active Grouping Chips */}
                    <div
                      className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-slate-300 rounded-md min-h-[32px] transition-colors"
                      data-testid="group-chips-container"
                      onDragOver={handleContainerDragOver}
                      onDrop={handleContainerDrop}
                    >
                      {groupByKeys.length === 0 ? (
                        <span className="text-xs text-slate-400 italic px-2">None (Flat List)</span>
                      ) : (
                        groupByKeys.map((key, idx) => {
                          const isDragging = draggedKey === key;
                          const showBefore = dropIndicator?.key === key && dropIndicator.position === 'before';
                          const showAfter = dropIndicator?.key === key && dropIndicator.position === 'after';

                          return (
                            <div key={key} className="flex items-center">
                              {showBefore && (
                                <div className="w-1 h-6 bg-blue-600 rounded-full animate-pulse mr-1 -ml-0.5" />
                              )}
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(key, e)}
                                onDragOver={(e) => handleChipDragOver(key, e)}
                                onDrop={(e) => handleChipDrop(key, e)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold select-none cursor-grab active:cursor-grabbing transition-all border ${
                                  isDragging
                                    ? 'opacity-30 bg-slate-100 border-dashed border-slate-400 scale-95'
                                    : 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-900 border-blue-200 shadow-2xs'
                                }`}
                                title="Drag to swap or reorder hierarchy"
                              >
                                <GripVertical className="w-3.5 h-3.5 text-blue-500 pointer-events-none shrink-0" />
                                <span className="pointer-events-none select-none">{GROUP_FIELD_LABELS[key]}</span>

                                {/* Optional quick nudge buttons */}
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveKey(idx, idx - 1);
                                    }}
                                    className="text-blue-400 hover:text-blue-800 px-0.5 font-bold hover:bg-blue-200/50 rounded cursor-pointer text-[11px]"
                                    title={`Move ${GROUP_FIELD_LABELS[key]} left`}
                                    aria-label={`Move ${GROUP_FIELD_LABELS[key]} left`}
                                  >
                                    ‹
                                  </button>
                                )}
                                {idx < groupByKeys.length - 1 && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveKey(idx, idx + 1);
                                    }}
                                    className="text-blue-400 hover:text-blue-800 px-0.5 font-bold hover:bg-blue-200/50 rounded cursor-pointer text-[11px]"
                                    title={`Move ${GROUP_FIELD_LABELS[key]} right`}
                                    aria-label={`Move ${GROUP_FIELD_LABELS[key]} right`}
                                  >
                                    ›
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeGroupKey(key);
                                  }}
                                  className="text-blue-500 hover:text-blue-800 ml-0.5 p-0.5 rounded hover:bg-blue-200/60 cursor-pointer"
                                  title={`Remove ${GROUP_FIELD_LABELS[key]}`}
                                  aria-label={`Remove ${GROUP_FIELD_LABELS[key]}`}
                                >
                                  <X className="w-3 h-3 pointer-events-none" />
                                </button>
                              </div>
                              {showAfter && (
                                <div className="w-1 h-6 bg-blue-600 rounded-full animate-pulse ml-1 -mr-0.5" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Available Pills to Add */}
                    {availableKeys.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="text-[11px] text-slate-400 font-sans">Available:</span>
                        {availableKeys.map((key) => (
                          <button
                            key={key}
                            type="button"
                            draggable
                            onDragStart={(e) => handleDragStart(key, e)}
                            onDragEnd={handleDragEnd}
                            onClick={() => addGroupKey(key)}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-medium cursor-grab active:cursor-grabbing transition-colors"
                            title={`Click or drag into container to group by ${GROUP_FIELD_LABELS[key]}`}
                          >
                            <Plus className="w-3 h-3 text-slate-400 pointer-events-none" />
                            <span className="pointer-events-none select-none">{GROUP_FIELD_LABELS[key]}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Fallback Accessible Group By Select */}
                    <select
                      aria-label="Group By"
                      value={groupByKeys.length === 1 ? groupByKeys[0] : groupByKeys.length === 0 ? 'none' : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'none') {
                          setGroupByKeys([]);
                        } else if (val) {
                          setGroupByKeys([val as GroupByField]);
                        }
                        setCollapsedGroups({});
                      }}
                      className="sr-only"
                    >
                      <option value="none">None (Flat List)</option>
                      <option value="tradedate">Trade Date</option>
                      <option value="symbol">Symbol</option>
                      <option value="side">Side (BUY / SELL)</option>
                      <option value="account">Account (Investment / Leverage)</option>
                    </select>

                    {/* Controls: Reset & Toggle Expand/Collapse */}
                    <div className="flex items-center gap-1.5 ml-2">
                      {groupByKeys.length !== 1 || groupByKeys[0] !== 'tradedate' ? (
                        <button
                          type="button"
                          onClick={resetToDefault}
                          className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 hover:bg-slate-100 rounded text-slate-600 font-medium cursor-pointer transition-colors"
                          title="Reset to default (Trade Date)"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>Reset</span>
                        </button>
                      ) : null}

                      {groupByKeys.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleAllGroups}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer transition-colors shadow-2xs"
                        >
                          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
                          <span>{areAllCollapsed ? 'Expand All' : 'Collapse All'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
                    <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 font-medium text-blue-800">
                      Clean List Mode
                    </span>
                    {sortColumn && (
                      <span className="text-slate-600 text-xs">
                        Sorted by <span className="font-semibold text-blue-700">{sortColumn.toUpperCase()}</span> ({sortDirection === 'asc' ? 'ascending' : 'descending'})
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
                {sortColumn && (
                  <button
                    type="button"
                    onClick={() => {
                      setSortColumn(null);
                      setSortDirection(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 underline cursor-pointer mr-2"
                  >
                    Clear Sort
                  </button>
                )}
                <span>
                  Showing <span className="font-semibold text-slate-800">{trades.length}</span> executed trades
                  {viewMode === 'group' && groupByKeys.length > 0 ? (
                    <span>
                      {' '}
                      across <span className="font-semibold text-slate-800">{tradeGroups.length}</span> groups
                    </span>
                  ) : (
                    <span> (flat list)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Dual Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800 border-collapse">
                <thead>
                  {/* Tier 1 Header */}
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    {activeMetadataCols.map((col) => (
                      <th
                        key={col}
                        rowSpan={2}
                        onClick={() => handleSort(col)}
                        aria-sort={sortColumn === col ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                        title={`Sort by ${GROUP_FIELD_LABELS[col]}`}
                        className="py-2.5 px-3 border-r border-slate-200 select-none cursor-pointer hover:bg-slate-200/70 transition-colors group"
                      >
                        <div className="flex items-center gap-1 font-bold group-hover:text-blue-700 select-none w-full text-left">
                          <span>{GROUP_FIELD_LABELS[col]}</span>
                          {sortColumn === col ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </th>
                    ))}
                    <th
                      rowSpan={2}
                      className="py-2.5 px-3 border-r border-slate-200 select-none text-left font-bold uppercase tracking-wider text-[11px]"
                    >
                      Currency
                    </th>
                    <th
                      colSpan={3}
                      className="py-1.5 px-3 text-center bg-emerald-50 text-emerald-800 border-r border-b border-emerald-200"
                    >
                      BUY
                    </th>
                    <th
                      colSpan={3}
                      className="py-1.5 px-3 text-center bg-rose-50 text-rose-800 border-r border-b border-rose-200"
                    >
                      SELL
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort('remarks')}
                      aria-sort={sortColumn === 'remarks' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Remarks"
                      className="py-2.5 px-3 border-r border-slate-200 select-none cursor-pointer hover:bg-slate-200/70 transition-colors group"
                    >
                      <div className="flex items-center gap-1 font-bold group-hover:text-blue-700 select-none text-left">
                        <span>Remarks</span>
                        {sortColumn === 'remarks' ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                    </th>
                    <th rowSpan={2} className="py-2.5 px-2 text-center w-20 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                  {/* Tier 2 Sub-Headers */}
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase select-none">
                    <th
                      onClick={() => handleSort('price')}
                      aria-sort={sortColumn === 'price' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Price"
                      className="py-1.5 px-2 text-right bg-emerald-50/50 text-emerald-900 border-r border-slate-200 cursor-pointer hover:bg-emerald-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Price</span>
                        {sortColumn === 'price' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('quantity')}
                      aria-sort={sortColumn === 'quantity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Quantity"
                      className="py-1.5 px-2 text-right bg-emerald-50/50 text-emerald-900 border-r border-slate-200 cursor-pointer hover:bg-emerald-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Quantity</span>
                        {sortColumn === 'quantity' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('consideration')}
                      aria-sort={sortColumn === 'consideration' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Consideration"
                      className="py-1.5 px-2 text-right bg-emerald-50/50 text-emerald-900 border-r border-slate-200 cursor-pointer hover:bg-emerald-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Consideration</span>
                        {sortColumn === 'consideration' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('price')}
                      aria-sort={sortColumn === 'price' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Price"
                      className="py-1.5 px-2 text-right bg-rose-50/50 text-rose-900 border-r border-slate-200 cursor-pointer hover:bg-rose-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Price</span>
                        {sortColumn === 'price' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('quantity')}
                      aria-sort={sortColumn === 'quantity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Quantity"
                      className="py-1.5 px-2 text-right bg-rose-50/50 text-rose-900 border-r border-slate-200 cursor-pointer hover:bg-rose-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Quantity</span>
                        {sortColumn === 'quantity' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('consideration')}
                      aria-sort={sortColumn === 'consideration' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      title="Sort by Consideration"
                      className="py-1.5 px-2 text-right bg-rose-50/50 text-rose-900 border-r border-slate-200 cursor-pointer hover:bg-rose-100/70 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold group-hover:text-blue-700 select-none w-full">
                        <span>Consideration</span>
                        {sortColumn === 'consideration' ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-700" /> : <ChevronDown className="w-3 h-3 text-blue-700" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={activeMetadataCols.length + 9} className="py-8 text-center text-slate-400 font-sans">
                        No executed trades recorded yet.
                      </td>
                    </tr>
                  ) : viewMode === 'list' || groupByKeys.length === 0 ? (
                    /* Flat list view */
                    sortedTrades.map((t, i) => {
                      const isBuy = String(t.buysell).toUpperCase() === 'B';
                      const amount = (t.quantity || 0) * (t.price || 0);
                      const ccy = getTradeCurrency(t);
                      const ccyPrefix = getCurrencyPrefix(ccy);
                      return (
                        <tr key={t.id || i} className="hover:bg-slate-50 transition-colors">
                          {activeMetadataCols.map((col, cIdx) =>
                            renderMetadataCell(col, t, false, cIdx === 0)
                          )}
                          {/* Currency */}
                          <td className="py-2 px-3 whitespace-nowrap font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${getCurrencyBadgeClasses(ccy)}`}
                            >
                              {ccy}
                            </span>
                          </td>
                          {/* BUY Cluster */}
                          <td className="py-2 px-2 text-right font-mono">
                            {isBuy ? `${ccyPrefix}${(t.price || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700">
                            {isBuy ? (t.quantity || 0).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            {isBuy
                              ? `${ccyPrefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          {/* SELL Cluster */}
                          <td className="py-2 px-2 text-right font-mono">
                            {!isBuy ? `${ccyPrefix}${(t.price || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold text-rose-700">
                            {!isBuy ? (t.quantity || 0).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                            {!isBuy
                              ? `${ccyPrefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          {/* Remarks */}
                          <td className="py-2 px-3 text-slate-500 font-sans truncate max-w-xs">{t.remarks || '—'}</td>
                          {/* Actions */}
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(t)}
                                className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                title={`Edit trade ${t.symbol}`}
                                aria-label={`Edit trade ${t.symbol}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTrade(t)}
                                className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title={`Delete trade ${t.symbol}`}
                                aria-label={`Delete trade ${t.symbol}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    /* Grouped dual ledger view */
                    tradeGroups.map((group) => {
                      const isCollapsed = !!collapsedGroups[group.key];
                      const groupPrefix = getCurrencyPrefix(
                        group.trades.length > 0 ? getTradeCurrency(group.trades[0]) : 'USD'
                      );
                      return (
                        <React.Fragment key={group.key}>
                          {/* Sub-Aggregation Accordion Header */}
                          <tr
                            onClick={() => toggleGroup(group.key)}
                            className="bg-slate-100 hover:bg-slate-200/80 cursor-pointer border-t-2 border-b border-slate-300 select-none transition-colors"
                          >
                            <td colSpan={activeMetadataCols.length + 9} className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center justify-between gap-2.5">
                                {/* Group Title & Count */}
                                <div className="flex items-center gap-2">
                                  {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                  )}
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                                    {group.label}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                                    {group.trades.length} {group.trades.length === 1 ? 'trade' : 'trades'}
                                  </span>
                                </div>

                                {/* Integrated Sub-Aggregation Metrics Strip (only visible when grouped primarily by Symbol) */}
                                {isGroupedBySymbolFirst && (
                                  <div data-testid="sub-aggregation-strip" className="flex flex-wrap items-center gap-2 font-mono text-xs">
                                    <div className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                        Avg Buy
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        {group.avgBuyPrice > 0 ? `${groupPrefix}${group.avgBuyPrice.toFixed(2)}` : '—'}
                                      </span>
                                    </div>
                                    <div className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                        Avg Sell
                                      </span>
                                      <span className="font-bold text-rose-700">
                                        {group.avgSellPrice > 0 ? `${groupPrefix}${group.avgSellPrice.toFixed(2)}` : '—'}
                                      </span>
                                    </div>
                                    <div className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                        Bal
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          group.balanceShares > 0
                                            ? 'text-blue-700'
                                            : group.balanceShares < 0
                                            ? 'text-amber-700'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {group.balanceShares > 0
                                          ? `+${group.balanceShares.toLocaleString()}`
                                          : group.balanceShares.toLocaleString()}{' '}
                                        shs
                                      </span>
                                    </div>
                                    <div className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                        Realized
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          group.realizedPnL > 0
                                            ? 'text-emerald-700'
                                            : group.realizedPnL < 0
                                            ? 'text-rose-700'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {group.realizedPnL >= 0
                                          ? `+${groupPrefix}${group.realizedPnL.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`
                                          : `-${groupPrefix}${Math.abs(group.realizedPnL).toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`}
                                      </span>
                                    </div>
                                    <div className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                        Unrealized
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          group.unrealizedPnL > 0
                                            ? 'text-emerald-700'
                                            : group.unrealizedPnL < 0
                                            ? 'text-rose-700'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {group.unrealizedPnL >= 0
                                          ? `+${groupPrefix}${group.unrealizedPnL.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`
                                          : `-${groupPrefix}${Math.abs(group.unrealizedPnL).toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Expand/Collapse Helper */}
                                <div className="text-slate-400 text-[10px] font-sans">
                                  {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Detail Rows */}
                          {!isCollapsed &&
                            group.trades.map((t, idx) => {
                              const isBuy = String(t.buysell).toUpperCase() === 'B';
                              const amount = (t.quantity || 0) * (t.price || 0);
                              const ccy = getTradeCurrency(t);
                              const ccyPrefix = getCurrencyPrefix(ccy);
                              return (
                                <tr
                                  key={t.id || `${group.key}-${idx}`}
                                  className="hover:bg-slate-50/80 bg-white transition-colors"
                                >
                                  {activeMetadataCols.map((col, cIdx) =>
                                    renderMetadataCell(col, t, true, cIdx === 0)
                                  )}
                                  {/* Currency */}
                                  <td className="py-2 px-3 whitespace-nowrap font-sans">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${getCurrencyBadgeClasses(ccy)}`}
                                    >
                                      {ccy}
                                    </span>
                                  </td>
                                  {/* BUY Cluster */}
                                  <td className="py-2 px-2 text-right font-mono">
                                    {isBuy ? `${ccyPrefix}${(t.price || 0).toFixed(2)}` : '—'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-700">
                                    {isBuy ? (t.quantity || 0).toLocaleString() : '—'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                                    {isBuy
                                      ? `${ccyPrefix}${amount.toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}`
                                      : '—'}
                                  </td>
                                  {/* SELL Cluster */}
                                  <td className="py-2 px-2 text-right font-mono">
                                    {!isBuy ? `${ccyPrefix}${(t.price || 0).toFixed(2)}` : '—'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-rose-700">
                                    {!isBuy ? (t.quantity || 0).toLocaleString() : '—'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                                    {!isBuy
                                      ? `${ccyPrefix}${amount.toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}`
                                      : '—'}
                                  </td>
                                  {/* Remarks */}
                                  <td className="py-2 px-3 text-slate-500 font-sans truncate max-w-xs">
                                    {t.remarks || '—'}
                                  </td>
                                  {/* Actions */}
                                  <td className="py-2 px-2 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(t)}
                                        className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                        title={`Edit trade ${t.symbol}`}
                                        aria-label={`Edit trade ${t.symbol}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTrade(t)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                        title={`Delete trade ${t.symbol}`}
                                        aria-label={`Delete trade ${t.symbol}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                {trades.length > 0 && (
                  <tfoot>
                    {/* Dynamic Multi-Currency Sub-Totals (alphabetical order) */}
                    {multiCurrencySummaries.currencies.map((entry, idx) => {
                      const prefix = getCurrencyPrefix(entry.currency);
                      const sub = entry.subtotal;
                      const rowBg =
                        idx === 0
                          ? 'bg-slate-50 border-t-2 border-slate-300'
                          : idx % 2 === 1
                          ? 'bg-sky-50/40 border-t border-slate-200'
                          : 'bg-slate-50 border-t border-slate-200';
                      const labelColor =
                        entry.currency === 'SGD'
                          ? 'text-blue-900'
                          : entry.currency === 'HKD'
                          ? 'text-amber-900'
                          : 'text-slate-800';
                      return (
                        <tr
                          key={entry.currency}
                          data-testid={`subtotal-row-${entry.currency}`}
                          className={`${rowBg} text-xs text-slate-800 font-mono`}
                        >
                          <td
                            colSpan={activeMetadataCols.length + 1}
                            className={`py-2.5 px-3 uppercase tracking-wider font-bold font-sans ${labelColor}`}
                          >
                            {entry.currency} Sub-Total ({sub.count}{' '}
                            {sub.count === 1 ? 'trade' : 'trades'})
                          </td>
                          {/* BUY Price & Qty intentionally omitted for multi-symbol currency sub-totals */}
                          <td className="py-2.5 px-2 text-right"></td>
                          <td className="py-2.5 px-2 text-right"></td>
                          <td className="py-2.5 px-2 text-right font-bold text-emerald-800">
                            {prefix}
                            {sub.totalBuyConsideration.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          {/* SELL Price & Qty intentionally omitted for multi-symbol currency sub-totals */}
                          <td className="py-2.5 px-2 text-right"></td>
                          <td className="py-2.5 px-2 text-right"></td>
                          <td className="py-2.5 px-2 text-right font-bold text-rose-800">
                            {prefix}
                            {sub.totalSellConsideration.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            <span className="text-[11px] font-semibold text-slate-700">
                              Realized:{' '}
                              <span
                                className={
                                  sub.realizedPnL >= 0
                                    ? 'text-emerald-700 font-bold'
                                    : 'text-rose-700 font-bold'
                                }
                              >
                                {sub.realizedPnL >= 0
                                  ? `+${prefix}${sub.realizedPnL.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : `-${prefix}${Math.abs(sub.realizedPnL).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 px-2"></td>
                        </tr>
                      );
                    })}

                    {/* Consolidated Grand Total (USD) */}
                    <tr
                      data-testid="grand-total-row"
                      className="bg-slate-100 border-t-2 border-slate-400 text-xs text-slate-900 font-mono font-bold"
                    >
                      <td
                        colSpan={activeMetadataCols.length + 1}
                        className="py-3 px-3 uppercase tracking-wider font-bold font-sans text-slate-900"
                      >
                        <div className="flex items-center gap-2">
                          <span>
                            Grand Total ({multiCurrencySummaries.consolidated.count}{' '}
                            {multiCurrencySummaries.consolidated.count === 1 ? 'trade' : 'trades'})
                          </span>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono uppercase">
                            Consolidated USD
                          </span>
                        </div>
                      </td>
                      {/* BUY Price & Qty intentionally omitted for multi-symbol grand total */}
                      <td className="py-3 px-2 text-right"></td>
                      <td className="py-3 px-2 text-right"></td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-800">
                        ${multiCurrencySummaries.consolidated.totalBuyConsiderationUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {/* SELL Price & Qty intentionally omitted for multi-symbol grand total */}
                      <td className="py-3 px-2 text-right"></td>
                      <td className="py-3 px-2 text-right"></td>
                      <td className="py-3 px-2 text-right font-bold text-rose-800">
                        ${multiCurrencySummaries.consolidated.totalSellConsiderationUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-3 text-right font-sans">
                        <span className="text-[11px] font-semibold text-slate-800">
                          Realized:{' '}
                          <span
                            className={
                              multiCurrencySummaries.consolidated.realizedPnLUSD >= 0
                                ? 'text-emerald-700 font-bold'
                                : 'text-rose-700 font-bold'
                            }
                          >
                            {multiCurrencySummaries.consolidated.realizedPnLUSD >= 0
                              ? `+$${multiCurrencySummaries.consolidated.realizedPnLUSD.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : `-$${Math.abs(multiCurrencySummaries.consolidated.realizedPnLUSD).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Capital Tab Content */}
        {activeTab === 'capital' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Broker</th>
                  <th className="py-2.5 px-3">Flow Type</th>
                  <th className="py-2.5 px-3">Account Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Currency</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-2 text-center w-20 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {capital.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No capital transfers recorded.
                    </td>
                  </tr>
                ) : (
                  capital.map((c, i) => {
                    const isDeposit = String(c.transtype).toUpperCase() === 'D';
                    return (
                      <tr key={c.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600">{formatTradeDate(c.date)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.broker}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDeposit ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans">{c.accounttype}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {isDeposit ? '+' : '-'}${Math.abs(c.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-600">{c.currency}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-sans">{c.remarks || '—'}</td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCapitalModal(c)}
                              className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              title={`Edit capital entry ${c.broker} $${c.amount}`}
                              aria-label={`Edit capital entry ${c.broker}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCapital(c)}
                              className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title={`Delete capital entry ${c.broker} $${c.amount}`}
                              aria-label={`Delete capital entry ${c.broker}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Costs Tab Content */}
        {activeTab === 'costs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Cost Type</th>
                  <th className="py-2.5 px-3">Trade Link</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Currency</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-2 text-center w-20 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No standalone transaction costs recorded.
                    </td>
                  </tr>
                ) : (
                  costs.map((co, i) => (
                    <tr key={co.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600">{formatTradeDate(co.date)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 uppercase">{co.cost_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-slate-500">{co.trade_id ? `#${co.trade_id}` : 'Standalone'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-700">
                        -${co.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-600">{co.currency}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans">{co.remarks || '—'}</td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCostModal(co)}
                            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title={`Edit cost entry ${co.cost_type}`}
                            aria-label={`Edit cost entry ${co.cost_type}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCost(co)}
                            className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={`Delete cost entry ${co.cost_type}`}
                            aria-label={`Delete cost entry ${co.cost_type}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog for New Trade Ticket */}
      {activeTab === 'trades' && (
        <ModalDialog
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={getModalTitle()}
          size="md"
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
                onClick={handleCreateTrade}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Submit Trade
              </button>
            </div>
          }
        >
          <form onSubmit={handleCreateTrade} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trade-symbol-select" className="block text-slate-700 font-semibold mb-1">
                  Ticker Symbol <span className="text-red-500">*</span>
                </label>
                <select
                  id="trade-symbol-select"
                  aria-label="Ticker Symbol"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold uppercase bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  {watchlistSymbols.length === 0 ? (
                    <option value="" disabled>
                      No symbols in watchlist
                    </option>
                  ) : (
                    watchlistSymbols.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))
                  )}
                </select>
                {watchlistSymbols.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    No watchlist symbols available. Add symbols to Watchlist first.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trade Direction</label>
                <select
                  value={buysell}
                  onChange={(e) => setBuysell(e.target.value as 'B' | 'S')}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="B">BUY (Long Outlay)</option>
                  <option value="S">SELL (Short / Exit Inflow)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Execution Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Share Quantity</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Settlement Date</label>
              <input
                type="date"
                required
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="trade-remarks-input" className="block text-slate-700 font-semibold mb-1">
                Execution Remarks <span className="text-red-500">*</span>
              </label>
              <input
                id="trade-remarks-input"
                aria-label="Execution Remarks"
                type="text"
                required
                value={tradeRemarks}
                onChange={(e) => setTradeRemarks(e.target.value)}
                placeholder="Required: e.g. Tactical entry, Saxo desk"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-600 flex justify-between">
              <span>Total Consideration:</span>
              <span className="font-bold text-slate-900">${(price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Dialog for Edit Trade Ticket */}
      {editingTrade && (
        <ModalDialog
          isOpen={!!editingTrade}
          onClose={() => setEditingTrade(null)}
          title="Edit Trade Order Ticket"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateTrade}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          }
        >
          <form onSubmit={handleUpdateTrade} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-trade-symbol-select" className="block text-slate-700 font-semibold mb-1">
                  Ticker Symbol <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-trade-symbol-select"
                  aria-label="Edit Ticker Symbol"
                  required
                  value={editSymbol}
                  onChange={(e) => setEditSymbol(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold uppercase bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  {editSymbol && !watchlistSymbols.includes(editSymbol) && (
                    <option key={editSymbol} value={editSymbol}>
                      {editSymbol}
                    </option>
                  )}
                  {watchlistSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trade Direction</label>
                <select
                  value={editBuysell}
                  onChange={(e) => setEditBuysell(e.target.value as 'B' | 'S')}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="B">BUY (Long Outlay)</option>
                  <option value="S">SELL (Short / Exit Inflow)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Execution Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Share Quantity</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account</label>
                <select
                  value={editInvestment ? 'investment' : 'leverage'}
                  onChange={(e) => setEditInvestment(e.target.value === 'investment')}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="investment">Investment</option>
                  <option value="leverage">Leverage</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Settlement Date</label>
                <input
                  type="date"
                  required
                  value={editTradeDate}
                  onChange={(e) => setEditTradeDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-trade-remarks-input" className="block text-slate-700 font-semibold mb-1">
                Execution Remarks <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-trade-remarks-input"
                aria-label="Edit Execution Remarks"
                type="text"
                required
                value={editTradeRemarks}
                onChange={(e) => setEditTradeRemarks(e.target.value)}
                placeholder="Required: e.g. Tactical entry, Saxo desk"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-600 flex justify-between">
              <span>Total Consideration:</span>
              <span className="font-bold text-slate-900">${(editPrice * editQuantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Dialog for Adjust Capital */}
      {activeTab === 'capital' && (
        <ModalDialog
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={getModalTitle()}
          size="md"
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
                onClick={handleAdjustCapital}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          }
        >
          <form onSubmit={handleAdjustCapital} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Flow Type</label>
                <select
                  value={capTransType}
                  onChange={(e) => setCapTransType(e.target.value as 'D' | 'W')}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="D">DEPOSIT (Capital Injection)</option>
                  <option value="W">WITHDRAWAL (Capital Outflow)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Broker / Custodian</label>
                <input
                  type="text"
                  required
                  value={capBroker}
                  onChange={(e) => setCapBroker(e.target.value)}
                  placeholder="e.g. Saxo, Interactive Brokers"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={capAmount}
                  onChange={(e) => setCapAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Currency</label>
                <input
                  type="text"
                  required
                  value={capCurrency}
                  onChange={(e) => setCapCurrency(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono uppercase focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Type</label>
                <select
                  value={capAccountType}
                  onChange={(e) => setCapAccountType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="Cash">Cash</option>
                  <option value="Margin">Margin</option>
                  <option value="Leverage">Leverage</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Effective Date</label>
                <input
                  type="date"
                  required
                  value={capDate}
                  onChange={(e) => setCapDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
              <input
                type="text"
                value={capRemarks}
                onChange={(e) => setCapRemarks(e.target.value)}
                placeholder="e.g. Monthly funding injection"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Dialog for New Cost */}
      {activeTab === 'costs' && (
        <ModalDialog
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={getModalTitle()}
          size="md"
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
                onClick={handleCreateCost}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          }
        >
          <form onSubmit={handleCreateCost} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cost Type</label>
                <select
                  value={costType}
                  onChange={(e) => setCostType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-semibold focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="commission">Commission</option>
                  <option value="sec_fee">SEC Fee</option>
                  <option value="finra_taf">FINRA TAF</option>
                  <option value="platform_fee">Platform / Custody Fee</option>
                  <option value="borrow_fee">Borrow Fee (Short)</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={costAmount}
                  onChange={(e) => setCostAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Currency</label>
                <input
                  type="text"
                  required
                  value={costCurrency}
                  onChange={(e) => setCostCurrency(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono uppercase focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trade Link (Optional)</label>
                <select
                  value={costTradeId}
                  onChange={(e) => setCostTradeId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="">Standalone (No Trade Linked)</option>
                  {trades.slice(0, 20).map((tr) => (
                    <option key={tr.id} value={String(tr.id)}>
                      #{tr.id} - {tr.symbol} ({tr.buysell === 'B' ? 'BUY' : 'SELL'}) on {tr.tradedate}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Fee Date</label>
              <input
                type="date"
                required
                value={costDate}
                onChange={(e) => setCostDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
              <input
                type="text"
                value={costRemarks}
                onChange={(e) => setCostRemarks(e.target.value)}
                placeholder="e.g. Broker execution fee"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Dialog for Edit Capital */}
      {editingCapital && (
        <ModalDialog
          isOpen={!!editingCapital}
          onClose={() => setEditingCapital(null)}
          title="Edit Capital Entry"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCapital(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCapital}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          }
        >
          <form onSubmit={handleUpdateCapital} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Flow Type</label>
                <select
                  value={editCapTransType}
                  onChange={(e) => setEditCapTransType(e.target.value as 'D' | 'W')}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="D">DEPOSIT (Capital Injection)</option>
                  <option value="W">WITHDRAWAL (Capital Outflow)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Broker / Custodian</label>
                <input
                  type="text"
                  required
                  value={editCapBroker}
                  onChange={(e) => setEditCapBroker(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Type</label>
                <select
                  value={editCapAccountType}
                  onChange={(e) => setEditCapAccountType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="Cash">Cash (C)</option>
                  <option value="Margin">Margin (M)</option>
                  <option value="Investment">Investment</option>
                  <option value="Leverage">Leverage</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Currency</label>
                <select
                  value={editCapCurrency}
                  onChange={(e) => setEditCapCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="SGD">SGD</option>
                  <option value="USD">USD</option>
                  <option value="HKD">HKD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Transfer Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editCapAmount}
                  onChange={(e) => setEditCapAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={editCapDate}
                  onChange={(e) => setEditCapDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-capital-remarks-input" className="block text-slate-700 font-semibold mb-1">
                Execution Remarks <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-capital-remarks-input"
                aria-label="Edit Capital Remarks"
                type="text"
                required
                value={editCapRemarks}
                onChange={(e) => setEditCapRemarks(e.target.value)}
                placeholder="Required: e.g. Monthly transfer, rebalancing"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Dialog for Edit Cost */}
      {editingCost && (
        <ModalDialog
          isOpen={!!editingCost}
          onClose={() => setEditingCost(null)}
          title="Edit Transaction Cost Entry"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCost(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCost}
                className="px-4 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 text-xs font-semibold cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          }
        >
          <form onSubmit={handleUpdateCost} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cost Type</label>
                <select
                  value={editCostType}
                  onChange={(e) => setEditCostType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold bg-white focus:ring-1 focus:ring-blue-700 outline-hidden uppercase"
                >
                  <option value="commission">Commission</option>
                  <option value="platform_fee">Platform Fee</option>
                  <option value="stamp_duty">Stamp Duty</option>
                  <option value="exchange_fee">Exchange Fee</option>
                  <option value="financing_interest">Financing Interest</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fee Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editCostAmount}
                  onChange={(e) => setEditCostAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Currency</label>
                <select
                  value={editCostCurrency}
                  onChange={(e) => setEditCostCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                >
                  <option value="SGD">SGD</option>
                  <option value="USD">USD</option>
                  <option value="HKD">HKD</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Settlement Date</label>
                <input
                  type="date"
                  required
                  value={editCostDate}
                  onChange={(e) => setEditCostDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Linked Trade ID (Optional)</label>
              <input
                type="number"
                value={editCostTradeId}
                onChange={(e) => setEditCostTradeId(e.target.value)}
                placeholder="Leave blank for standalone portfolio cost"
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="edit-cost-remarks-input" className="block text-slate-700 font-semibold mb-1">
                Cost Remarks <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-cost-remarks-input"
                aria-label="Edit Cost Remarks"
                type="text"
                required
                value={editCostRemarks}
                onChange={(e) => setEditCostRemarks(e.target.value)}
                placeholder="Required: e.g. Clearing fee, custody maintenance"
                className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-700 outline-hidden"
              />
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
};

export default TransactionsView;
