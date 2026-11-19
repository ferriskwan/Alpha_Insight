import React, { useState } from 'react';
import { ChartRenderMode, OhlcvValue, TradeRecord } from '../../types/api';
import { SegmentedControl, BentoCard } from '../../design-system';
import MatplotlibChartView from './MatplotlibChartView';
import InteractiveCanvasChart from './InteractiveCanvasChart';
import { LineChart, BarChart2, Columns } from 'lucide-react';

export interface ChartComparisonViewProps {
  chartScreenshot?: string | null;
  values?: OhlcvValue[];
  trades?: TradeRecord[];
  onZoomChange?: (zoomStart: string, zoomEnd: string) => Promise<void>;
  isZooming?: boolean;
  className?: string;
}

export const ChartComparisonView: React.FC<ChartComparisonViewProps> = ({
  chartScreenshot,
  values = [],
  trades = [],
  onZoomChange,
  isZooming = false,
  className,
}) => {
  const [mode, setMode] = useState<ChartRenderMode>('matplotlib');

  const options = [
    {
      value: 'matplotlib' as ChartRenderMode,
      label: 'Matplotlib (charting.py)',
      icon: <LineChart className="w-3.5 h-3.5" />,
    },
    {
      value: 'canvas' as ChartRenderMode,
      label: 'Interactive Canvas',
      icon: <BarChart2 className="w-3.5 h-3.5" />,
    },
    {
      value: 'split' as ChartRenderMode,
      label: 'Split Compare',
      icon: <Columns className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <BentoCard
      title="Dual Chart Engine"
      subtitle="Pixel-perfect server Matplotlib PNG vs client Canvas TradingView"
      headerRight={
        <SegmentedControl<ChartRenderMode>
          options={options}
          value={mode}
          onChange={(newMode) => setMode(newMode)}
          size="sm"
        />
      }
      className={className}
    >
      <div className="mt-2">
        {mode === 'matplotlib' && (
          <MatplotlibChartView
            chartScreenshot={chartScreenshot}
            values={values}
            trades={trades}
            onZoomChange={onZoomChange}
            isZooming={isZooming}
          />
        )}

        {mode === 'canvas' && (
          <InteractiveCanvasChart
            values={values}
            trades={trades}
            showIndicators={true}
          />
        )}

        {mode === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                Engine 1: Matplotlib (charting.py)
              </span>
              <MatplotlibChartView
                chartScreenshot={chartScreenshot}
                values={values}
                trades={trades}
                onZoomChange={onZoomChange}
                isZooming={isZooming}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                Engine 2: Interactive Canvas (lightweight-charts)
              </span>
              <InteractiveCanvasChart
                values={values}
                trades={trades}
                showIndicators={true}
              />
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
};

export default ChartComparisonView;
