import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Compass,
} from 'lucide-react';
import { HeatmapGrid, ChartContainer } from '../../design-system';
import apiClient from '../../services/apiClient';
import { SectorPerformanceResponse, SectorItem } from '../../types/api';

export const IndustrySectorView: React.FC = () => {
  const [data, setData] = useState<SectorPerformanceResponse | null>(null);
  const [horizon, setHorizon] = useState<string>('1D');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getSectorPerformance(horizon);
      setData(res);
      if (res.sectors && res.sectors.length > 0) {
        setSelectedSector(res.sectors[0]);
      }
    } catch (err) {
      console.error('Failed to load sector performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [horizon]);

  const sectors = data?.sectors || [];
  const benchmarkReturn = data?.benchmarkReturn || 0.75;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-700" />
            GICS Industry & Sector Heatmap
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            S&P 500 GICS sector relative performance, index weightings, and quadrant rotation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Horizon Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-xs">
            {['1D', '1W', '1M', 'YTD', '1Y'].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={`px-2.5 py-1 rounded font-mono font-semibold transition-colors cursor-pointer ${
                  horizon === h ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh Sector Performance"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sector Heatmap Grid Component from Design System */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">11 GICS Sectors Relative Performance</span>
            <span className="text-xs font-mono text-slate-500">Benchmark SPY: +{benchmarkReturn}%</span>
          </div>
          <span className="text-xs text-slate-400">Click any sector to inspect metrics</span>
        </div>

        <HeatmapGrid
          items={sectors}
          onItemClick={(item) => setSelectedSector(item as SectorItem)}
          columns={4}
        />
      </div>

      {/* Sector Details & Relative Rotation Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-200 font-bold text-xs text-slate-900 flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-700" />
          Sector Relative Rotation Analysis
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800 border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3">Sector Name</th>
                <th className="py-2.5 px-3 text-right">Horizon Return</th>
                <th className="py-2.5 px-3 text-right">S&P 500 Weight</th>
                <th className="py-2.5 px-3">Relative Rotation</th>
                <th className="py-2.5 px-3 text-right">Alpha vs SPY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {sectors.map((s) => {
                const isPos = s.value >= 0;
                const alpha = s.value - benchmarkReturn;
                const isAlphaPos = alpha >= 0;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSector(s)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-bold text-blue-700">{s.ticker}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">{s.label}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPos ? '+' : ''}{s.value.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{s.weight.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.relativeRotation === 'Leading'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.relativeRotation === 'Improving'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.relativeRotation}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${isAlphaPos ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isAlphaPos ? '+' : ''}{alpha.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IndustrySectorView;
