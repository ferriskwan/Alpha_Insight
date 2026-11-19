import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { ChartContainer, MetricCard } from '../../design-system';
import apiClient from '../../services/apiClient';
import { PortfolioOverviewResponse } from '../../types/api';

export const PortfolioOverview: React.FC = () => {
  const [data, setData] = useState<PortfolioOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currency, setCurrency] = useState<string>('USD');
  const [timeframe, setTimeframe] = useState<string>('1Y');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPortfolioOverview({ currency });
      setData(res);
    } catch (err) {
      console.error('Failed to load portfolio overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currency]);

  const kpis = {
    netAssetValue: Number(data?.kpis?.netAssetValue ?? 124580.45),
    cashBalance: Number(data?.kpis?.cashBalance ?? 24500.0),
    marginLoan: Number(data?.kpis?.marginLoan ?? 0.0),
    dayPnL: Number(data?.kpis?.dayPnL ?? 1420.5),
    realizedPnL: Number(data?.kpis?.realizedPnL ?? 8450.2),
    unrealizedPnL: Number(data?.kpis?.unrealizedPnL ?? 16130.25),
    pctReturn: Number(data?.kpis?.pctReturn ?? 19.8),
    currency: data?.kpis?.currency || 'USD',
  };

  const chart1 = data?.chart1_equity_vs_benchmark || [];
  const chart2 = data?.chart2_cumulative_pnl || [];
  const chart3 = data?.chart3_asset_allocation || [];
  const chart4 = data?.chart4_daily_pnl_drawdown || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-700" />
            Institutional Portfolio Overview
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Synchronized multi-asset performance, risk allocation, and bidirectional cost accounting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Currency Pill Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-xs">
            {['USD', 'SGD', 'HKD'].map((ccy) => (
              <button
                key={ccy}
                type="button"
                onClick={() => setCurrency(ccy)}
                className={`px-2.5 py-1 rounded font-mono font-semibold transition-colors cursor-pointer ${
                  currency === ccy ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ccy}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard
          label="Net Asset Value"
          value={`$${(kpis.netAssetValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`Base Currency: ${kpis.currency}`}
          variant="default"
        />
        <MetricCard
          label="Cash Available"
          value={`$${(kpis.cashBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Unencumbered liquidity"
          variant="default"
        />
        <MetricCard
          label="Margin Liability"
          value={`$${(kpis.marginLoan ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Leverage loan drawn"
          variant={(kpis.marginLoan ?? 0) > 0 ? 'negative' : 'default'}
        />
        <MetricCard
          label="Day's PnL"
          value={`${(kpis.dayPnL ?? 0) >= 0 ? '+' : ''}$${(kpis.dayPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Daily change"
          variant={(kpis.dayPnL ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Realized PnL"
          value={`${(kpis.realizedPnL ?? 0) >= 0 ? '+' : ''}$${(kpis.realizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Closed trades"
          variant={(kpis.realizedPnL ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Unrealized PnL"
          value={`${(kpis.unrealizedPnL ?? 0) >= 0 ? '+' : ''}$${(kpis.unrealizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Open positions"
          variant={(kpis.unrealizedPnL ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Total Return"
          value={`${(kpis.pctReturn ?? 0) >= 0 ? '+' : ''}${(kpis.pctReturn ?? 0).toFixed(2)}%`}
          subtext="Since inception"
          variant={(kpis.pctReturn ?? 0) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* Synchronized 4-Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Equity vs SPY Benchmark */}
        <ChartContainer
          title="Portfolio Equity Curve vs SPY Benchmark"
          subtitle="Total Net Equity against normalized SPY buy-and-hold benchmark"
          selectedTimeframe={timeframe}
          onTimeframeChange={setTimeframe}
          isLoading={loading}
        >
          <div className="h-64 flex flex-col justify-between pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block" />
                  Portfolio NAV: ${(kpis.netAssetValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                  SPY Benchmark: ${Number(chart1[chart1.length - 1]?.benchmark ?? 118500).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <span className="text-emerald-700 font-semibold font-sans">+2.4% vs Bench</span>
            </div>

            {/* SVG Normalized Comparison Chart */}
            <svg viewBox="0 0 500 200" className="w-full h-48 overflow-visible">
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

              {/* Benchmark Curve */}
              <polyline
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="4 4"
                points="0,170 80,160 160,150 240,140 320,135 400,120 500,110"
              />

              {/* Equity Gradient Fill */}
              <polygon
                fill="url(#equityGradient)"
                points="0,170 80,150 160,130 240,110 320,80 400,60 500,45 500,200 0,200"
              />

              {/* Portfolio Equity Line */}
              <polyline
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.5"
                points="0,170 80,150 160,130 240,110 320,80 400,60 500,45"
              />

              {/* Live Price Tag */}
              <circle cx="500" cy="45" r="4" fill="#1d4ed8" stroke="#ffffff" strokeWidth="2" />
            </svg>
          </div>
        </ChartContainer>

        {/* Chart 2: Cumulative Realized vs Unrealized PnL */}
        <ChartContainer
          title="Cumulative Realized vs Unrealized PnL"
          subtitle="Signed accounting breakdown across closed gains and open exposure"
          selectedTimeframe={timeframe}
          onTimeframeChange={setTimeframe}
          isLoading={loading}
        >
          <div className="h-64 flex flex-col justify-between pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block" />
                  Realized: +${(kpis.realizedPnL ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  Unrealized: +${(kpis.unrealizedPnL ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <span className="text-slate-600 font-sans">Total: +${((kpis.realizedPnL ?? 0) + (kpis.unrealizedPnL ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            <svg viewBox="0 0 500 200" className="w-full h-48 overflow-visible">
              <line x1="0" y1="140" x2="500" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />
              <polyline
                fill="none"
                stroke="#047857"
                strokeWidth="2"
                points="0,140 100,130 200,115 300,100 400,90 500,80"
              />
              <polyline
                fill="none"
                stroke="#818CF8"
                strokeWidth="2"
                strokeDasharray="2 2"
                points="0,140 100,120 200,105 300,75 400,65 500,50"
              />
            </svg>
          </div>
        </ChartContainer>

        {/* Chart 3: Asset & Currency Allocation */}
        <ChartContainer
          title="Asset & Currency Exposure Distribution"
          subtitle="Proportional weight of equities, cash balances, and margin liabilities"
          isLoading={loading}
        >
          <div className="h-64 flex flex-col justify-center space-y-3 pt-2">
            {chart3.length > 0 ? (
              chart3.slice(0, 5).map((item, idx) => {
                const itemVal = Number(item.value ?? 0);
                const itemPct = Number(item.percentage ?? 0);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-slate-700">
                      <span className="font-semibold">{item.name}</span>
                      <span>
                        ${itemVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({itemPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0
                            ? 'bg-blue-700'
                            : idx === 1
                            ? 'bg-indigo-600'
                            : idx === 2
                            ? 'bg-emerald-600'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, itemPct))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-700">
                  <span className="font-semibold">Equities (US Tech & Large Cap)</span>
                  <span>$100,080.45 (80.3%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-700 rounded-full" style={{ width: '80.3%' }} />
                </div>

                <div className="flex justify-between text-xs font-mono text-slate-700 pt-2">
                  <span className="font-semibold">Cash Available (USD)</span>
                  <span>$24,500.00 (19.7%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: '19.7%' }} />
                </div>
              </div>
            )}
          </div>
        </ChartContainer>

        {/* Chart 4: Daily PnL Distribution & High-Water Mark Drawdown */}
        <ChartContainer
          title="Daily PnL & High-Water Mark Drawdown"
          subtitle="Daily net profit distribution with institutional peak drawdown curve"
          isLoading={loading}
        >
          <div className="h-64 flex flex-col justify-between pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 pb-2 border-b border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                Max Drawdown: -4.12%
              </span>
              <span className="text-slate-600">Peak Equity: $125,800</span>
            </div>

            <svg viewBox="0 0 500 200" className="w-full h-48 overflow-visible">
              {/* Center Zero line */}
              <line x1="0" y1="120" x2="500" y2="120" stroke="#cbd5e1" strokeWidth="1" />

              {/* Daily bars */}
              {[
                { x: 20, h: 25, pos: true },
                { x: 50, h: 15, pos: true },
                { x: 80, h: 20, pos: false },
                { x: 110, h: 35, pos: true },
                { x: 140, h: 10, pos: false },
                { x: 170, h: 40, pos: true },
                { x: 200, h: 12, pos: true },
                { x: 230, h: 30, pos: false },
                { x: 260, h: 22, pos: true },
                { x: 290, h: 45, pos: true },
                { x: 320, h: 18, pos: false },
                { x: 350, h: 28, pos: true },
                { x: 380, h: 50, pos: true },
                { x: 410, h: 14, pos: true },
                { x: 440, h: 8, pos: false },
                { x: 470, h: 32, pos: true },
              ].map((bar, i) => (
                <rect
                  key={i}
                  x={bar.x}
                  y={bar.pos ? 120 - bar.h : 120}
                  width="14"
                  height={bar.h}
                  fill={bar.pos ? '#047857' : '#b91c1c'}
                  opacity="0.85"
                  rx="1"
                />
              ))}

              {/* Drawdown line */}
              <polyline
                fill="none"
                stroke="#B91C1C"
                strokeWidth="2"
                points="0,150 80,155 160,150 240,165 320,158 400,152 500,150"
              />
            </svg>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
};

export default PortfolioOverview;
