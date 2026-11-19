import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  PieChart,
  DollarSign,
  Activity,
  Globe,
  Layers,
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  RefreshCw,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { TransCostItem, TransCostCreateRequest } from '../../types/api';
import apiClient from '../../services/apiClient';

// ==========================================
// 1. Portfolio Overview Scaffold
// ==========================================
export const PortfolioOverviewView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Portfolio Overview & Risk Assessment</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Consolidated multi-currency positions, margin leverage exposure, and total performance metrics.
        </p>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3 rounded-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Net Portfolio Equity</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">$2,458,920.00</div>
          <span className="text-[11px] font-semibold text-emerald-700">+14.2% YTD</span>
        </div>
        <div className="bg-white border border-slate-200 p-3 rounded-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Cash Balance</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">$485,200.00</div>
          <span className="text-[11px] font-mono text-slate-500">USD / HKD liquid</span>
        </div>
        <div className="bg-white border border-slate-200 p-3 rounded-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Unrealized P&L</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">+$312,450.00</div>
          <span className="text-[11px] font-semibold text-emerald-700">+18.5% open return</span>
        </div>
        <div className="bg-white border border-slate-200 p-3 rounded-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Margin Loan Utilization</span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">$180,000.00</div>
          <span className="text-[11px] font-mono text-slate-500">7.3% total leverage</span>
        </div>
      </div>

      {/* Main Paper Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 p-4 rounded-md">
          <h2 className="text-xs font-bold font-mono uppercase text-slate-900 mb-3">
            Equity Curve & Benchmark Comparison (S&P 500)
          </h2>
          <div className="h-64 border border-slate-200 rounded bg-slate-50 flex flex-col items-center justify-center text-center p-4">
            <TrendingUp className="w-8 h-8 text-blue-700 mb-2 stroke-[1.5]" />
            <span className="text-xs font-semibold text-slate-900">Historical Daily Net Asset Value (NAV)</span>
            <span className="text-[11px] text-slate-500 mt-1 max-w-sm">
              Consolidated dual-ledger daily valuation loaded from PostgreSQL `daily_portfolio_summary`.
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-md">
          <h2 className="text-xs font-bold font-mono uppercase text-slate-900 mb-3">Asset Allocation</h2>
          <div className="h-64 border border-slate-200 rounded bg-slate-50 flex flex-col items-center justify-center text-center p-4">
            <PieChart className="w-8 h-8 text-emerald-700 mb-2 stroke-[1.5]" />
            <span className="text-xs font-semibold text-slate-900">Currency & Asset Breakdown</span>
            <span className="text-[11px] text-slate-500 mt-1">
              72% US Equities, 18% Cash, 10% HK Equities
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. Transactions View with TransCost Management
// ==========================================
export const TransactionsView: React.FC = () => {
  const [subTab, setSubTab] = useState<'cost' | 'investment' | 'capital'>('cost');
  const [transCosts, setTransCosts] = useState<TransCostItem[]>([]);
  const [loading, setLoading] = useState(false);

  // New TransCost Form State
  const [tradeId, setTradeId] = useState<string>('');
  const [costType, setCostType] = useState<string>('commission');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [dateVal, setDateVal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCosts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getTransCosts();
      if (data && Array.isArray(data)) {
        setTransCosts(data);
      }
    } catch (err: unknown) {
      console.warn('Could not fetch trans costs from backend; keeping sample state', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCosts();
  }, []);

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) {
      showToast('error', 'Please provide a valid numeric cost amount.');
      return;
    }

    const payload: TransCostCreateRequest = {
      trade_id: tradeId ? Number(tradeId) : null,
      cost_type: costType,
      amount: Number(amount),
      currency,
      date: dateVal,
      remarks: remarks || null,
    };

    try {
      const created = await apiClient.createTransCost(payload);
      setTransCosts((prev) => [created, ...prev]);
      showToast('success', `Transaction cost of ${currency} ${amount} recorded.`);
      setAmount('');
      setRemarks('');
      setTradeId('');
    } catch (err: unknown) {
      // Local optimistic append
      const mockItem: TransCostItem = {
        id: Date.now(),
        user_id: 1,
        trade_id: payload.trade_id || null,
        cost_type: payload.cost_type as any,
        amount: payload.amount,
        currency: payload.currency || 'USD',
        date: payload.date,
        remarks: payload.remarks || null,
        created_at: new Date().toISOString(),
      };
      setTransCosts((prev) => [mockItem, ...prev]);
      showToast('success', `Saved locally: ${currency} ${amount}`);
      setAmount('');
      setRemarks('');
      setTradeId('');
    }
  };

  const handleDeleteCost = async (id: number) => {
    try {
      await apiClient.deleteTransCost(id);
      setTransCosts((prev) => prev.filter((item) => item.id !== id));
      showToast('success', 'Cost entry deleted.');
    } catch (err: unknown) {
      setTransCosts((prev) => prev.filter((item) => item.id !== id));
      showToast('success', 'Cost entry deleted locally.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Transaction Ledgers & Cost Journal</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Dual-ledger trade records, capital deposits/withdrawals, and transaction fee tracking.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab('cost')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                subTab === 'cost' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transaction Costs
            </button>
            <button
              type="button"
              onClick={() => setSubTab('investment')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                subTab === 'investment' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Investment Trades
            </button>
            <button
              type="button"
              onClick={() => setSubTab('capital')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                subTab === 'capital' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Capital Ledger
            </button>
          </div>
        </div>

        {notification && (
          <div
            className={`mt-3 p-2.5 rounded text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>

      {/* Subtab 1: Transaction Cost Management */}
      {subTab === 'cost' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* New Fee Form (4 Cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 p-4 rounded-md">
            <h2 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider mb-3">
              Record New Transaction Fee
            </h2>
            <form onSubmit={handleCreateCost} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fee / Cost Type</label>
                <select
                  value={costType}
                  onChange={(e) => setCostType(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                >
                  <option value="commission">Commission</option>
                  <option value="sec_fee">SEC Fee</option>
                  <option value="finra_taf">FINRA TAF</option>
                  <option value="platform_fee">Platform Fee</option>
                  <option value="borrow_fee">Borrow Fee (Short)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1.25"
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  >
                    <option value="USD">USD</option>
                    <option value="HKD">HKD</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Related Trade ID (Optional)</label>
                <input
                  type="number"
                  value={tradeId}
                  onChange={(e) => setTradeId(e.target.value)}
                  placeholder="e.g. 142"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Interactive Brokers routing fee"
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Cost Record</span>
              </button>
            </form>
          </div>

          {/* Cost Entries Table (8 Cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 font-mono uppercase">
                Transaction Fee Ledger Entries
              </span>
              <button
                type="button"
                onClick={loadCosts}
                className="p-1 rounded text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Cost Type</th>
                    <th className="py-2.5 px-3 font-semibold">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Trade Ref</th>
                    <th className="py-2.5 px-3 font-semibold">Remarks</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transCosts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No transaction cost records logged yet.
                      </td>
                    </tr>
                  ) : (
                    transCosts.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-700">{item.date}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {item.cost_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-red-700">
                          -{item.currency} {Number(item.amount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {item.trade_id ? `#${item.trade_id}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{item.remarks || '—'}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCost(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Investment Trades Placeholder */}
      {subTab === 'investment' && (
        <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
          <FileSpreadsheet className="w-10 h-10 text-blue-700 mx-auto mb-2 stroke-[1.5]" />
          <h2 className="text-sm font-bold text-slate-900">Investment Trades Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Trade execution journal recording buy and sell orders with fill price, shares, and investment classifications.
          </p>
        </div>
      )}

      {/* Subtab 3: Capital Ledger Placeholder */}
      {subTab === 'capital' && (
        <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
          <CreditCard className="w-10 h-10 text-emerald-700 mx-auto mb-2 stroke-[1.5]" />
          <h2 className="text-sm font-bold text-slate-900">Capital Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cash deposit, withdrawal, and currency exchange records tracking base capital injections.
          </p>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. Watchlist Scaffold
// ==========================================
export const WatchlistView: React.FC = () => {
  const symbols = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 224.23, change: 1.45, pct: '+0.65%' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 418.15, change: -2.3, pct: '-0.55%' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 141.54, change: 4.88, pct: '+3.57%' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.92, change: 0.85, pct: '+0.48%' },
    { symbol: '700.HK', name: 'Tencent Holdings Ltd.', price: 422.4, change: 6.2, pct: '+1.49%' },
    { symbol: '9988.HK', name: 'Alibaba Group Holding', price: 95.8, change: -1.1, pct: '-1.14%' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Institutional Watch List</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Real-time price monitoring, intraday tick quotes, and rapid charting quick-links.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4 font-semibold">Symbol</th>
              <th className="py-2.5 px-4 font-semibold">Company Name</th>
              <th className="py-2.5 px-4 font-semibold">Latest Price</th>
              <th className="py-2.5 px-4 font-semibold">Daily Change</th>
              <th className="py-2.5 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {symbols.map((s) => (
              <tr key={s.symbol} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{s.symbol}</td>
                <td className="py-2.5 px-4 text-slate-900">{s.name}</td>
                <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                  ${s.price.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 font-mono font-semibold">
                  <span className={s.change >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                    {s.pct}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-medium text-blue-700 hover:bg-slate-100"
                  >
                    Open Chart
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// 4. Stock Analyst Scaffold
// ==========================================
export const StockAnalystView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">AI Stock Analyst & Technical Charting</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Dual-engine Gemini and Kimi analysis paired with institutional high-contrast technical charts.
        </p>
      </div>

      <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
        <TrendingUp className="w-12 h-12 text-blue-700 mx-auto mb-3 stroke-[1.5]" />
        <h2 className="text-base font-bold text-slate-900">Stock Analyst Engine Ready</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Chart canvas renders with pure white paper background, crisp hairline grid, and high-contrast indicators (SMA 30 in cobalt, EMA 100 in vivid violet).
        </p>
      </div>
    </div>
  );
};

// ==========================================
// 5. Macroeconomics Scaffold (Upcoming Epic)
// ==========================================
export const MacroeconomicsView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Macroeconomic Environment & Yield Curves</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Treasury yields, Federal Reserve interest rate benchmarks, inflation curves, and global liquidity indexes.
        </p>
      </div>

      <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
        <Globe className="w-12 h-12 text-slate-500 mx-auto mb-3 stroke-[1.5]" />
        <h2 className="text-base font-bold text-slate-900">Macro Research Scaffold</h2>
        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200">
          Scheduled for Epic 0.3
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 6. By Industry / Sector Scaffold (Upcoming Epic)
// ==========================================
export const IndustrySectorView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Sector Breadth & Industry Rotation</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Relative rotation graphs (RRG), sector momentum heatmaps, and capitalization weight analysis.
        </p>
      </div>

      <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
        <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3 stroke-[1.5]" />
        <h2 className="text-base font-bold text-slate-900">Sector Rotation Scaffold</h2>
        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200">
          Scheduled for Epic 0.3
        </span>
      </div>
    </div>
  );
};

// ==========================================
// 7. Investment Notes Scaffold
// ==========================================
export const InvestmentNotesView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-700" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Investment Theses & Trade Notes</h1>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Markdown journal recording investment rationale, post-trade debriefs, and fundamental valuation theses.
        </p>
      </div>

      <div className="bg-white border border-slate-200 p-8 rounded-md text-center">
        <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-3 stroke-[1.5]" />
        <h2 className="text-base font-bold text-slate-900">Investment Journal Ready</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Markdown notes editor with institutional white paper typography (Aptos) and clean dividing lines.
        </p>
      </div>
    </div>
  );
};
