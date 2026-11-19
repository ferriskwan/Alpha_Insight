import React, { useState, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Percent,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { PortfolioDashboardResponse } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import {
  BentoCard,
  SegmentedControl,
  MetricCard,
  SwipeableKpiStrip,
  Button,
} from '../../design-system';
import BalanceMatrixCard from './BalanceMatrixCard';
import PerformanceCurveCard from './PerformanceCurveCard';
import DualLedgerPnL from './DualLedgerPnL';

export const PortfolioManager: React.FC = () => {
  const [currency, setCurrency] = useState<string>('USD');
  const [account, setAccount] = useState<string>('All');
  const [data, setData] = useState<PortfolioDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (ccy: string, acc: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getPortfolioDashboard(ccy, acc);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load portfolio metrics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(currency, account);
  }, [currency, account]);

  const summary = data?.summary;
  const isTotalPos = (summary?.totalPnL ?? 0) >= 0;
  const isUnrealizedPos = (summary?.unrealizedPnL ?? 0) >= 0;
  const isRealizedPos = (summary?.realizedPnL ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Portfolio Filter & Command Bar */}
      <BentoCard
        title="Portfolio Analytics & Multi-Currency Engine"
        subtitle="Consolidated mark-to-market valuations and dual-ledger asset attribution"
        icon={<Wallet className="w-4 h-4 text-accent-primary" />}
        headerRight={
          <div className="flex items-center gap-2">
            <SegmentedControl<string>
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'HKD', label: 'HKD' },
              ]}
              value={currency}
              onChange={(c) => setCurrency(c)}
              size="sm"
            />
            <SegmentedControl<string>
              options={[
                { value: 'All', label: 'All Accounts' },
                { value: 'Investment', label: 'Investment' },
                { value: 'Leverage', label: 'Leverage' },
              ]}
              value={account}
              onChange={(a) => setAccount(a)}
              size="sm"
            />
            <Button
              variant="ghost"
              size="sm"
              loading={loading}
              onClick={() => fetchDashboard(currency, account)}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              aria-label="Refresh Dashboard"
            />
          </div>
        }
      >
        {error && (
          <div className="p-3 mb-2 rounded-lg bg-semantic-negative/15 border border-semantic-negative/30 flex items-start gap-2 text-xs text-semantic-negative">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </BentoCard>

      {/* KPI Top Strip */}
      <SwipeableKpiStrip columns={5}>
        <MetricCard
          label="Total Net Equity"
          value={`$${Number(summary?.totalEquity ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`Pivot: ${currency}`}
          icon={<DollarSign className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          label="Cash Available"
          value={`$${Number(summary?.cashBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Uninvested Liquidity"
          icon={<Wallet className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          label="Total PnL ($)"
          value={`${isTotalPos ? '+' : ''}$${Number(summary?.totalPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`${isTotalPos ? '+' : ''}${(summary?.pctReturn ?? 0).toFixed(2)}% Return`}
          trend={isTotalPos ? 'up' : 'down'}
          trendValue={`${(summary?.pctReturn ?? 0).toFixed(2)}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          variant={isTotalPos ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Unrealized PnL"
          value={`${isUnrealizedPos ? '+' : ''}$${Number(summary?.unrealizedPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext="Open Floating Gain/Loss"
          trend={isUnrealizedPos ? 'up' : 'down'}
          icon={<Percent className="w-4 h-4" />}
          variant={isUnrealizedPos ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Margin Loan Balance"
          value={`$${Number(summary?.marginLoan ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`Daily Interest: $${Number(summary?.dailyInterest ?? 0).toFixed(2)}`}
          icon={<ShieldAlert className="w-4 h-4" />}
          variant={Number(summary?.marginLoan ?? 0) > 0 ? 'negative' : 'default'}
        />
      </SwipeableKpiStrip>

      {/* Performance Curve */}
      <PerformanceCurveCard points={data?.performanceSeries || []} />

      {/* Multi-Currency Balance Matrix */}
      <BalanceMatrixCard rows={data?.balanceMatrix || []} />

      {/* Dual Ledger Open Positions */}
      <DualLedgerPnL positions={data?.positions || []} />
    </div>
  );
};

export default PortfolioManager;
