import React from 'react';
import { Database, Binary, MessageSquareText, Calculator } from 'lucide-react';
import { MarketDataset, TradeRecord } from '../../types/api';
import { BentoCard, AccordionCard, MetricCard, SwipeableKpiStrip } from '../../design-system';

export interface RawDataViewProps {
  symbol: string;
  eodData: MarketDataset | null;
  tickData: MarketDataset | null;
  trades: TradeRecord[];
  prompt?: string;
  className?: string;
}

export const RawDataView: React.FC<RawDataViewProps> = ({
  symbol,
  eodData,
  tickData,
  trades = [],
  prompt = '',
  className,
}) => {
  const eodCount = eodData?.values?.length || 0;
  const tickCount = tickData?.values?.length || 0;
  const tradeCount = trades.length;

  const eodJsonStr = eodData ? JSON.stringify(eodData, null, 2) : 'No EOD dataset loaded';
  const tickJsonStr = tickData ? JSON.stringify(tickData, null, 2) : 'No Tick dataset loaded';

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Metrics Strip */}
      <SwipeableKpiStrip columns={4}>
        <MetricCard
          label="Active Symbol"
          value={symbol || 'N/A'}
          subtext="Selected Vector"
          icon={<Database className="w-4 h-4" />}
        />
        <MetricCard
          label="EOD Bars"
          value={eodCount}
          subtext="Daily OHLCV"
          icon={<Binary className="w-4 h-4" />}
        />
        <MetricCard
          label="Intraday 5M Bars"
          value={tickCount}
          subtext="Ticks Ingested"
          icon={<Binary className="w-4 h-4" />}
        />
        <MetricCard
          label="Trade Records"
          value={tradeCount}
          subtext="Executed Trades"
          icon={<Calculator className="w-4 h-4" />}
        />
      </SwipeableKpiStrip>

      {/* Accordion Drawers for Inspection */}
      <div className="space-y-3">
        <AccordionCard
          title="Generated Quantitative Prompt"
          subtitle="System prompt delivered to Gemini / Kimi LLM"
          icon={<MessageSquareText className="w-4 h-4 text-accent-ai" />}
          defaultExpanded={true}
        >
          <pre className="p-3 rounded-lg bg-surface-elevated/70 border border-subtle text-xs font-mono text-secondary whitespace-pre-wrap max-h-80 overflow-y-auto">
            {prompt || 'No prompt generated yet.'}
          </pre>
        </AccordionCard>

        <AccordionCard
          title={`EOD OHLCV Payload (${eodCount} bars)`}
          subtitle="Raw JSON representation from PostgreSQL eoddata"
          icon={<Database className="w-4 h-4" />}
          defaultExpanded={false}
        >
          <pre className="p-3 rounded-lg bg-surface-elevated/70 border border-subtle text-xs font-mono text-secondary whitespace-pre-wrap max-h-80 overflow-y-auto">
            {eodJsonStr}
          </pre>
        </AccordionCard>

        <AccordionCard
          title={`Intraday Tick Payload (${tickCount} ticks)`}
          subtitle="Raw JSON representation from PostgreSQL tickdata (5m)"
          icon={<Binary className="w-4 h-4" />}
          defaultExpanded={false}
        >
          <pre className="p-3 rounded-lg bg-surface-elevated/70 border border-subtle text-xs font-mono text-secondary whitespace-pre-wrap max-h-80 overflow-y-auto">
            {tickJsonStr}
          </pre>
        </AccordionCard>
      </div>
    </div>
  );
};

export default RawDataView;
