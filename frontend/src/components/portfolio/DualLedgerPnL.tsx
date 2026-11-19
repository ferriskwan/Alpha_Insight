import React from 'react';
import { DollarSign } from 'lucide-react';
import { PositionRecord } from '../../types/api';
import { BentoCard, ResponsiveTable, TableColumn, Badge } from '../../design-system';

export interface DualLedgerPnLProps {
  positions: PositionRecord[];
  className?: string;
}

export const DualLedgerPnL: React.FC<DualLedgerPnLProps> = ({ positions, className }) => {
  const columns: TableColumn<PositionRecord>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (p) => <strong className="text-primary font-bold">{p.symbol}</strong>,
    },
    {
      key: 'investment',
      header: 'Ledger',
      render: (p) => (
        <Badge variant={p.investment ? 'cash' : 'margin'}>
          {p.investment ? 'Investment' : 'Leverage'}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      render: (p) => Number(p.quantity).toLocaleString(),
    },
    {
      key: 'avgprice',
      header: 'Avg Price',
      align: 'right',
      render: (p) => `$${Number(p.avgprice).toFixed(2)}`,
    },
    {
      key: 'eodprice',
      header: 'EOD Price',
      align: 'right',
      render: (p) => `$${Number(p.eodprice).toFixed(2)}`,
    },
    {
      key: 'marketValue',
      header: 'Market Value',
      align: 'right',
      render: (p) => {
        const mv = p.marketValue ?? Number(p.quantity) * Number(p.eodprice);
        return `$${Number(mv).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      },
    },
    {
      key: 'unrealizedPnL',
      header: 'Unrealized PnL',
      align: 'right',
      render: (p) => {
        const uPnL = p.unrealizedPnL ?? (Number(p.eodprice) - Number(p.avgprice)) * Number(p.quantity);
        const isPos = uPnL >= 0;
        return (
          <span className={isPos ? 'text-semantic-positive font-bold' : 'text-semantic-negative font-bold'}>
            {isPos ? '+' : ''}${Number(uPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'pctPnL',
      header: 'PnL %',
      align: 'right',
      render: (p) => {
        const pct =
          p.pctPnL ??
          (p.avgprice > 0 ? ((Number(p.eodprice) - Number(p.avgprice)) / Number(p.avgprice)) * 100 : 0);
        const isPos = pct >= 0;
        return (
          <span className={`font-bold ${isPos ? 'text-semantic-positive' : 'text-semantic-negative'}`}>
            {isPos ? '+' : ''}{pct.toFixed(2)}%
          </span>
        );
      },
    },
  ];

  return (
    <BentoCard
      title="Open Stock Positions & Dual Ledger PnL"
      subtitle="Mark-to-market position appraisal across Investment and Leverage accounts"
      icon={<DollarSign className="w-4 h-4 text-accent-primary" />}
      className={className}
    >
      <ResponsiveTable<PositionRecord>
        columns={columns}
        data={positions}
        keyExtractor={(p, idx) => `${p.symbol}-${p.investment ? 'inv' : 'lev'}-${idx}`}
        emptyMessage="No open stock positions found in portfolio."
      />
    </BentoCard>
  );
};

export default DualLedgerPnL;
