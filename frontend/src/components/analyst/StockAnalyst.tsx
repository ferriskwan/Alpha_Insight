import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sparkles,
  RefreshCw,
  Sliders,
  Database,
  BarChart2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  WatchlistSymbolItem,
  WatchlistDataResponse,
  AnalysisModulesConfig,
  AnalyzeResponsePayload,
} from '../../types/api';
import { apiClient } from '../../services/apiClient';
import { buildStockAnalysisPrompt, DEFAULT_ANALYSIS_MODULES } from '../../lib/promptBuilder';
import {
  BentoCard,
  AccordionCard,
  SegmentedControl,
  PillToggle,
  Button,
  Select,
  Badge,
} from '../../design-system';
import ChartComparisonView from './ChartComparisonView';
import ReportView from './ReportView';
import RawDataView from './RawDataView';

export const StockAnalyst: React.FC = () => {
  const [symbols, setSymbols] = useState<WatchlistSymbolItem[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [watchlistData, setWatchlistData] = useState<WatchlistDataResponse | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis state
  const [provider, setProvider] = useState<'gemini' | 'kimi'>('gemini');
  const [modules, setModules] = useState<AnalysisModulesConfig>({ ...DEFAULT_ANALYSIS_MODULES });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponsePayload | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'chart' | 'report' | 'raw'>('chart');

  // Load watchlist symbols
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getWatchlistSymbols()
      .then((items) => {
        if (!isMounted) return;
        setSymbols(items);
        if (items.length > 0 && !selectedSymbol) {
          setSelectedSymbol(items[0].symbol);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load watchlist');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch watchlist data when symbol changes
  const loadSymbolData = async (sym: string, zoomStart?: string, zoomEnd?: string) => {
    if (!sym) return;
    setLoadingData(true);
    setError(null);
    try {
      const data = await apiClient.getWatchlistData(sym, zoomStart, zoomEnd);
      setWatchlistData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch symbol data';
      setError(msg);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedSymbol) {
      loadSymbolData(selectedSymbol);
    }
  }, [selectedSymbol]);

  const handleZoomChange = async (zoomStart: string, zoomEnd: string) => {
    if (selectedSymbol) {
      await loadSymbolData(selectedSymbol, zoomStart, zoomEnd);
    }
  };

  const handleModuleToggle = (key: keyof AnalysisModulesConfig) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentItem = symbols.find((s) => s.symbol === selectedSymbol);
  const generatedPrompt = buildStockAnalysisPrompt({
    symbol: selectedSymbol,
    name: currentItem?.name || selectedSymbol,
    modules,
  });

  const handleRunAnalysis = async () => {
    if (!selectedSymbol) return;
    setIsAnalyzing(true);
    setError(null);
    setActiveSubTab('report');
    try {
      const res = await apiClient.analyzeStock({
        symbol: selectedSymbol,
        provider,
        prompt: generatedPrompt,
        modules,
        chartScreenshot: watchlistData?.chartScreenshot,
      });
      setAnalysisResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const subTabOptions: { value: 'chart' | 'report' | 'raw'; label: string; icon: React.ReactNode }[] = [
    { value: 'chart', label: 'Charts & Technicals', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { value: 'report', label: 'AI Synthesis Report', icon: <FileText className="w-3.5 h-3.5" /> },
    { value: 'raw', label: 'Raw Payload & Metrics', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls Card: Symbol Selection, Provider & Module Toggles */}
      <BentoCard
        title="Stock Analyst Command Bar"
        subtitle="Configure target equity, tactical analysis modules, and AI inference engine"
        icon={<TrendingUp className="w-4 h-4" />}
        headerRight={
          <div className="flex items-center gap-2">
            <SegmentedControl<'gemini' | 'kimi'>
              options={[
                { value: 'gemini', label: 'Gemini' },
                { value: 'kimi', label: 'Kimi' },
              ]}
              value={provider}
              onChange={(p) => setProvider(p)}
              size="sm"
            />
            <Button
              variant="ai"
              size="sm"
              loading={isAnalyzing}
              onClick={handleRunAnalysis}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Analyze
            </Button>
          </div>
        }
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mt-2">
          {/* Symbol Select */}
          <div className="flex items-center gap-2.5 min-w-[260px]">
            <Select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="flex-1"
            >
              {symbols.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} — {item.name} ({item.currency})
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="sm"
              loading={loadingData}
              onClick={() => loadSymbolData(selectedSymbol)}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              aria-label="Refresh Market Data"
            />
          </div>

          {/* Module Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <PillToggle
              label="Patterns"
              active={modules.chartPatternRecognition}
              onClick={() => handleModuleToggle('chartPatternRecognition')}
              size="sm"
            />
            <PillToggle
              label="Short-Term"
              active={modules.shortTermTechnical}
              onClick={() => handleModuleToggle('shortTermTechnical')}
              size="sm"
            />
            <PillToggle
              label="Long-Term"
              active={modules.longTermTechnical}
              onClick={() => handleModuleToggle('longTermTechnical')}
              size="sm"
            />
            <PillToggle
              label="Fundamental"
              active={modules.fundamental}
              onClick={() => handleModuleToggle('fundamental')}
              size="sm"
            />
            <PillToggle
              label="Valuation"
              active={modules.valuation}
              onClick={() => handleModuleToggle('valuation')}
              size="sm"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-semantic-negative/15 border border-semantic-negative/30 flex items-start gap-2 text-xs text-semantic-negative">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </BentoCard>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center justify-between">
        <SegmentedControl<'chart' | 'report' | 'raw'>
          options={subTabOptions}
          value={activeSubTab}
          onChange={(tab) => setActiveSubTab(tab)}
          size="md"
        />

        {selectedSymbol && (
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="neutral">{currentItem?.timezone || 'America/New_York'}</Badge>
            <Badge variant="accent">{currentItem?.currency || 'USD'}</Badge>
          </div>
        )}
      </div>

      {/* Feature Views Switching */}
      {activeSubTab === 'chart' && (
        <ChartComparisonView
          chartScreenshot={watchlistData?.chartScreenshot}
          values={watchlistData?.eodData?.values || []}
          trades={watchlistData?.trades || []}
          onZoomChange={handleZoomChange}
          isZooming={loadingData}
        />
      )}

      {activeSubTab === 'report' && (
        <ReportView
          report={analysisResult?.markdown || null}
          groundingLinks={analysisResult?.groundingLinks || []}
          symbol={selectedSymbol}
          name={currentItem?.name}
          isAnalyzing={isAnalyzing}
          error={error}
        />
      )}

      {activeSubTab === 'raw' && (
        <RawDataView
          symbol={selectedSymbol}
          eodData={watchlistData?.eodData || null}
          tickData={watchlistData?.tickData || null}
          trades={watchlistData?.trades || []}
          prompt={generatedPrompt}
        />
      )}
    </div>
  );
};

export default StockAnalyst;
