import React from 'react';
import { Layers } from 'lucide-react';
import { BalanceMatrixRow } from '../../types/api';
import { BentoCard, ResponsiveTable, TableColumn, Badge } from '../../design-system';

export interface BalanceMatrixCardProps {
  rows: BalanceMatrixRow[];
  className?: string;
}

export const BalanceMatrixCard: React.FC<BalanceMatrixCardProps> = ({ rows, className }) => {
  const columns: TableColumn<BalanceMatrixRow>[] = [
    {
      key: 'currency',
      header: 'Currency',
      render: (r) => <Badge variant="neutral">{r.currency}</Badge>,
    },
    {
      key: 'accountType',
      header: 'Account Ledger',
      render: (r) => (
        <Badge variant={r.accountType === 'Investment' ? 'cash' : 'margin'}>
          {r.accountType}
        </Badge>
      ),
    },
    {
      key: 'capitalInjected',
      header: 'Capital Injected',
      align: 'right',
      render: (r) => Number(r.capitalInjected).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      key: 'marketValue',
      header: 'Market Value',
      align: 'right',
      render: (r) => Number(r.marketValue).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      key: 'cashAvailable',
      header: 'Cash Balance',
      align: 'right',
      render: (r) => Number(r.cashAvailable).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      key: 'marginLoan',
      header: 'Margin Loan',
      align: 'right',
      render: (r) => {
        const val = Number(r.marginLoan);
        return (
          <span className={val > 0 ? 'text-semantic-negative font-bold' : 'text-primary'}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'realizedPnL',
      header: 'Realized PnL',
      align: 'right',
      render: (r) => {
        const val = Number(r.realizedPnL);
        return (
          <span className={val >= 0 ? 'text-semantic-positive' : 'text-semantic-negative'}>
            {val >= 0 ? '+' : ''}
            {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'unrealizedPnL',
      header: 'Unrealized PnL',
      align: 'right',
      render: (r) => {
        const val = Number(r.unrealizedPnL);
        return (
          <span className={val >= 0 ? 'text-semantic-positive' : 'text-semantic-negative'}>
            {val >= 0 ? '+' : ''}
            {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'netEquity',
      header: 'Net Equity',
      align: 'right',
      render: (r) => (
        <strong className="text-primary font-bold">
          {Number(r.netEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      key: 'pctReturn',
      header: 'Return %',
      align: 'right',
      render: (r) => {
        const val = Number(r.pctReturn);
        return (
          <span className={`font-bold ${val >= 0 ? 'text-semantic-positive' : 'text-semantic-negative'}`}>
            {val >= 0 ? '+' : ''}
            {val.toFixed(2)}%
          </span>
        );
      },
    },
  ];

  return (
    <BentoCard
      title="Multi-Currency Balance Matrix"
      subtitle="Dual ledger segregation across Investment (Cash) and Leverage (Margin)"
      icon={<Layers className="w-4 h-4 text-accent-primary" />}
      className={className}
    >
      <ResponsiveTable<BalanceMatrixRow>
        columns={columns}
        data={rows}
        keyExtractor={(r, idx) => `${r.currency}-${r.accountType}-${idx}`}
        emptyMessage="No balance matrix entries computed."
      />
    </BentoCard>
  );
};

export default BalanceMatrixCard;
