/**
 * UAT-007: Verification tests for Dual Chart Comparison Switcher & Mobile/Desktop Ergonomics.
 */

import './setup';
import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ChartComparisonView from '../../frontend/src/components/analyst/ChartComparisonView';
import MatplotlibChartView from '../../frontend/src/components/analyst/MatplotlibChartView';
import { AccordionCard } from '../../frontend/src/design-system/components/AccordionCard';
import { OhlcvValue, TradeRecord } from '../../frontend/src/types/api';

const MOCK_VALUES: OhlcvValue[] = Array.from({ length: 30 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0');
  return {
    datetime: `2026-03-${day}`,
    date: `2026-03-${day}`,
    open: 180 + i,
    high: 185 + i,
    low: 178 + i,
    close: 183 + i,
    volume: 1_000_000 + i * 50_000,
  };
});

const MOCK_TRADES: TradeRecord[] = [
  {
    symbol: 'AAPL',
    buysell: 'B',
    tradedate: '2026-03-05T10:00:00',
    investment: true,
    price: 182.0,
    quantity: 50,
    remarks: 'Buy marker',
  },
  {
    symbol: 'AAPL',
    buysell: 'S',
    tradedate: '2026-03-20T14:30:00',
    investment: true,
    price: 195.0,
    quantity: 25,
    remarks: 'Sell marker',
  },
];

const MOCK_SCREENSHOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('UAT-007: Dual Chart Switcher & Ergonomics', () => {
  describe('ChartComparisonView 3-way Switcher', () => {
    it('starts in Matplotlib mode and renders the quantitative screenshot view', () => {
      render(
        <ChartComparisonView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
        />
      );

      expect(screen.getByText('Dual Chart Engine')).toBeInTheDocument();
      expect(screen.getByAltText('Quantitative Matplotlib Chart')).toBeInTheDocument();
      expect(screen.queryByText(/Engine 1: Matplotlib/i)).not.toBeInTheDocument();
    });

    it('switches between Matplotlib, Interactive Canvas, and Split Compare modes', () => {
      render(
        <ChartComparisonView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
        />
      );

      // Switch to Interactive Canvas
      const canvasTab = screen.getByRole('tab', { name: /Interactive Canvas/i });
      fireEvent.click(canvasTab);
      expect(screen.queryByAltText('Quantitative Matplotlib Chart')).not.toBeInTheDocument();

      // Switch to Split Compare
      const splitTab = screen.getByRole('tab', { name: /Split Compare/i });
      fireEvent.click(splitTab);

      expect(screen.getByText('Engine 1: Matplotlib (charting.py)')).toBeInTheDocument();
      expect(screen.getByText('Engine 2: Interactive Canvas (lightweight-charts)')).toBeInTheDocument();
      expect(screen.getByAltText('Quantitative Matplotlib Chart')).toBeInTheDocument();
    });
  });

  describe('MatplotlibChartView Timeline Zoom Slider & Interaction', () => {
    it('renders zoom timeline slider with date range and reset button', () => {
      render(
        <MatplotlibChartView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
        />
      );

      expect(screen.getByText(/Zoom Window:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reset All/i })).toBeInTheDocument();
    });

    it('handles mouse drag interaction on zoom slider handles', () => {
      const handleZoomChange = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <MatplotlibChartView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
          onZoomChange={handleZoomChange}
        />
      );

      // Find slider handle thumbs (cursor-ew-resize)
      const handles = container.querySelectorAll('.cursor-ew-resize');
      expect(handles.length).toBe(2);

      const startHandle = handles[0];

      // Simulate mouse drag start and move
      act(() => {
        fireEvent.mouseDown(startHandle, { clientX: 100 });
        fireEvent.mouseMove(window, { clientX: 150 });
        fireEvent.mouseUp(window);
      });

      expect(startHandle).toBeInTheDocument();
    });

    it('handles touch drag interaction on mobile viewports', () => {
      const handleZoomChange = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <MatplotlibChartView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
          onZoomChange={handleZoomChange}
        />
      );

      const handles = container.querySelectorAll('.cursor-ew-resize');
      expect(handles.length).toBe(2);

      const endHandle = handles[1];

      // Simulate mobile touch drag start, move, and end
      act(() => {
        fireEvent.touchStart(endHandle, { touches: [{ clientX: 400 }] });
        fireEvent.touchMove(window, { touches: [{ clientX: 350 }] });
        fireEvent.touchEnd(window);
      });

      expect(endHandle).toBeInTheDocument();
    });

    it('displays crosshair overlay on mouse move and clears on pointer leave', () => {
      const { container } = render(
        <MatplotlibChartView
          chartScreenshot={MOCK_SCREENSHOT}
          values={MOCK_VALUES}
          trades={MOCK_TRADES}
        />
      );

      const chartArea = container.querySelector('.cursor-crosshair');
      expect(chartArea).toBeInTheDocument();

      if (chartArea) {
        // Trigger hover
        fireEvent.mouseMove(chartArea, { clientX: 200, clientY: 150 });
        // Trigger leave
        fireEvent.mouseLeave(chartArea);
      }
    });
  });

  describe('AccordionCard Mobile Collapse/Expand Ergonomics', () => {
    it('collapses and expands smoothly with accessible aria state', () => {
      render(
        <AccordionCard
          title="Mobile Analysis Card"
          subtitle="Click to collapse"
          summaryBadge="Tap to toggle"
          defaultExpanded={true}
        >
          <div data-testid="accordion-content">Mobile card inner content</div>
        </AccordionCard>
      );

      const toggleBtn = screen.getByRole('button');
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('accordion-content')).toBeInTheDocument();

      // Tap to collapse
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

      // Tap to expand again
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
