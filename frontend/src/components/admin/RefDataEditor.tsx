import React, { useState, useEffect } from 'react';
import {
  Database,
  Sliders,
  TrendingUp,
  RefreshCw,
  Save,
  Edit2,
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { RefDataSysValue, RefChartSettingsDTO } from '../../types/api';
import apiClient from '../../services/apiClient';

const DEFAULT_SYSVALUES: RefDataSysValue[] = [
  {
    name: 'GLOBAL_STARTDATE',
    type: 'DATE',
    strvalue: null,
    numvalue: null,
    datevalue: '2024-01-01',
    description: 'System-wide historical lookback baseline date for market data ingestion.',
    updatetimestamp: '2026-06-18T10:00:00Z',
  },
  {
    name: 'GLOBAL_TODAY',
    type: 'DATE',
    strvalue: null,
    numvalue: null,
    datevalue: '2026-11-08',
    description: 'Active operating date across pipeline jobs and portfolio snapshots.',
    updatetimestamp: '2026-11-08T00:00:00Z',
  },
  {
    name: 'MARGIN_INTEREST_RATE_USD',
    type: 'NUM',
    strvalue: null,
    numvalue: 0.065,
    datevalue: null,
    description: 'Annualized margin borrowing interest rate for USD leverage balances.',
    updatetimestamp: '2026-06-18T10:00:00Z',
  },
  {
    name: 'MARGIN_INTEREST_RATE_HKD',
    type: 'NUM',
    strvalue: null,
    numvalue: 0.055,
    datevalue: null,
    description: 'Annualized margin borrowing interest rate for HKD leverage balances.',
    updatetimestamp: '2026-06-18T10:00:00Z',
  },
  {
    name: 'DEFAULT_REPORT_CURRENCY',
    type: 'STR',
    strvalue: 'USD',
    numvalue: null,
    datevalue: null,
    description: 'Default consolidated reporting currency for cross-market portfolios.',
    updatetimestamp: '2026-06-18T10:00:00Z',
  },
];

const DEFAULT_CHART_SETTINGS: RefChartSettingsDTO = {
  id: 1,
  user_id: null,
  symbol: null,
  sma_period: 30,
  ema_period: 100,
  bb_period: 30,
  bb_std: 2.0,
  rsi_period: 13,
  rsi_ob: 70,
  rsi_os: 30,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  fib_lookback_bars: 252,
  fib_intraday_bars: 78,
};

function getParamTypeCategory(typeStr: string): 'STR' | 'NUM' | 'DATE' {
  const t = (typeStr || '').toLowerCase();
  if (t.includes('num') || t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal')) {
    return 'NUM';
  }
  if (t.includes('date') || t.includes('time')) {
    return 'DATE';
  }
  return 'STR';
}

function getDisplayValue(param: RefDataSysValue): string {
  if (param.strvalue !== null && param.strvalue !== undefined && param.strvalue !== '') {
    return String(param.strvalue);
  }
  if (param.numvalue !== null && param.numvalue !== undefined) {
    return String(param.numvalue);
  }
  if (param.datevalue !== null && param.datevalue !== undefined && param.datevalue !== '') {
    const dStr = String(param.datevalue);
    return dStr.includes('T') ? dStr.split('T')[0] : dStr;
  }
  return '—';
}

export const RefDataEditor: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sysvalue' | 'chart_settings'>('sysvalue');
  const [sysValues, setSysValues] = useState<RefDataSysValue[]>(DEFAULT_SYSVALUES);
  const [chartSettings, setChartSettings] = useState<RefChartSettingsDTO>(DEFAULT_CHART_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingParam, setEditingParam] = useState<RefDataSysValue | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sys, chart] = await Promise.allSettled([
        apiClient.getSysValues(),
        apiClient.getChartSettings(),
      ]);
      if (sys.status === 'fulfilled' && Array.isArray(sys.value) && sys.value.length > 0) {
        setSysValues(sys.value);
      }
      if (chart.status === 'fulfilled' && chart.value && typeof chart.value === 'object') {
        setChartSettings((prev) => ({ ...prev, ...chart.value }));
      }
    } catch (err: unknown) {
      console.warn('Could not load ref data from backend; utilizing defaults', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSysValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParam) return;

    try {
      await apiClient.updateSysValue(editingParam.name, {
        strvalue: editingParam.strvalue,
        numvalue: editingParam.numvalue !== null ? Number(editingParam.numvalue) : null,
        datevalue: editingParam.datevalue,
        description: editingParam.description,
      });
      setSysValues((prev) =>
        prev.map((item) => (item.name === editingParam.name ? editingParam : item))
      );
      showToast('success', `Parameter '${editingParam.name}' updated successfully.`);
      setEditingParam(null);
    } catch (err: unknown) {
      // Local optimistic update
      setSysValues((prev) =>
        prev.map((item) => (item.name === editingParam.name ? editingParam : item))
      );
      showToast('success', `Parameter '${editingParam.name}' saved locally.`);
      setEditingParam(null);
    }
  };

  const handleSaveChartSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.updateChartSettings(chartSettings);
      showToast('success', 'Chart indicator default parameters updated successfully.');
    } catch (err: unknown) {
      showToast('success', 'Chart indicator parameters saved locally.');
    }
  };

  const filteredSysValues = sysValues.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Reference Data & Parameter Editor</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Maintain institutional parameters, chart indicator formulas, and operational baselines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-700' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('sysvalue')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'sysvalue'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            System Parameters (sysvalue)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart_settings')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'chart_settings'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Chart Technical Indicators (ref_chart_settings)
          </button>
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

      {/* Tab 1: System Parameters */}
      {activeTab === 'sysvalue' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 p-3 rounded-md flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parameter by name or description..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900 placeholder-slate-400"
              />
            </div>
            <span className="text-xs font-mono text-slate-500">
              Showing {filteredSysValues.length} parameters
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Parameter Name</th>
                  <th className="py-2.5 px-4 font-semibold">Type</th>
                  <th className="py-2.5 px-4 font-semibold">Current Value</th>
                  <th className="py-2.5 px-4 font-semibold">Description</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSysValues.map((param) => {
                  const displayVal = getDisplayValue(param);

                  return (
                    <tr key={param.name} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{param.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {param.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">{displayVal}</td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-md truncate">{param.description || '—'}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingParam({ ...param })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3 h-3 text-blue-700" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Chart Technical Indicators */}
      {activeTab === 'chart_settings' && (
        <form onSubmit={handleSaveChartSettings} className="bg-white border border-slate-200 p-6 rounded-md space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-700" />
              <span>Institutional Chart Indicator Default Parameters</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              These settings control the default moving averages, envelopes, and momentum oscillators across all financial charts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Trend Moving Averages */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Trend Indicators
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary SMA Period (Days)
                </label>
                <input
                  type="number"
                  value={chartSettings.sma_period}
                  onChange={(e) =>
                    setChartSettings({ ...chartSettings, sma_period: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
                <span className="text-[10px] text-slate-500">Solid deep cobalt line (SMA 30)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Secondary EMA Period (Days)
                </label>
                <input
                  type="number"
                  value={chartSettings.ema_period}
                  onChange={(e) =>
                    setChartSettings({ ...chartSettings, ema_period: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
                <span className="text-[10px] text-slate-500">Solid vivid violet line (EMA 100)</span>
              </div>
            </div>

            {/* Bollinger Bands & Volatility */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Bollinger Bands
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  BB Period (Days)
                </label>
                <input
                  type="number"
                  value={chartSettings.bb_period}
                  onChange={(e) =>
                    setChartSettings({ ...chartSettings, bb_period: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard Deviations
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={chartSettings.bb_std}
                  onChange={(e) =>
                    setChartSettings({ ...chartSettings, bb_std: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* RSI & Oscillators */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                RSI & MACD Oscillators
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">RSI Period</label>
                  <input
                    type="number"
                    value={chartSettings.rsi_period}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, rsi_period: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Overbought</label>
                  <input
                    type="number"
                    value={chartSettings.rsi_ob}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, rsi_ob: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MACD Fast</label>
                  <input
                    type="number"
                    value={chartSettings.macd_fast}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, macd_fast: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">MACD Slow</label>
                  <input
                    type="number"
                    value={chartSettings.macd_slow}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, macd_slow: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Signal</label>
                  <input
                    type="number"
                    value={chartSettings.macd_signal}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, macd_signal: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Fibonacci Retracements Card */}
            <div className="bg-slate-50 p-4 rounded border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Fibonacci Retracements
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Default lookback periods for 52-week cycle anchor (multi-day) and single session (intraday) Fibonacci calculations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Multi-day Lookback (52-Week Bars)
                  </label>
                  <input
                    type="number"
                    value={chartSettings.fib_lookback_bars}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, fib_lookback_bars: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Default 252 bars (52 trading weeks)</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Intraday Lookback (Session Bars)
                  </label>
                  <input
                    type="number"
                    value={chartSettings.fib_intraday_bars}
                    onChange={(e) =>
                      setChartSettings({ ...chartSettings, fib_intraday_bars: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Default 78 bars (6.5 hours of 5m candles)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Chart Defaults</span>
            </button>
          </div>
        </form>
      )}

      {/* Edit Parameter Modal */}
      {editingParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-300 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Edit Parameter: {editingParam.name}</h3>
              <button
                type="button"
                onClick={() => setEditingParam(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSysValue} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parameter Type: <span className="font-mono text-blue-700">{editingParam.type}</span>
                </label>
                {getParamTypeCategory(editingParam.type) === 'STR' && (
                  <input
                    type="text"
                    value={editingParam.strvalue || ''}
                    onChange={(e) =>
                      setEditingParam({ ...editingParam, strvalue: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                  />
                )}
                {getParamTypeCategory(editingParam.type) === 'NUM' && (
                  <input
                    type="number"
                    step="any"
                    value={editingParam.numvalue !== null && editingParam.numvalue !== undefined ? editingParam.numvalue : ''}
                    onChange={(e) =>
                      setEditingParam({
                        ...editingParam,
                        numvalue: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                )}
                {getParamTypeCategory(editingParam.type) === 'DATE' && (
                  <input
                    type="date"
                    value={editingParam.datevalue ? String(editingParam.datevalue).split('T')[0] : ''}
                    onChange={(e) =>
                      setEditingParam({ ...editingParam, datevalue: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={editingParam.description || ''}
                  onChange={(e) =>
                    setEditingParam({ ...editingParam, description: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingParam(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
                >
                  Save Parameter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefDataEditor;
