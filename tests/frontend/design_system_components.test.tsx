import './setup';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SplitPaneLayout,
  BottomNavBar,
  ChartContainer,
  ModalDialog,
  HeatmapGrid,
} from '../../frontend/src/design-system';

describe('Design System Epic 0.3 Primitives', () => {
  describe('SplitPaneLayout', () => {
    it('renders single pane layout when layoutMode is single', () => {
      render(
        <SplitPaneLayout
          layoutMode="single"
          activeFocusPane="left"
          leftTitle="Overview"
          rightTitle="Stock Analyst"
          leftPane={<div data-testid="left-content">Left View</div>}
          rightPane={<div data-testid="right-content">Right View</div>}
        />
      );

      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      // In single mode, right pane is hidden
      expect(screen.queryByLabelText('Stock Analyst')).not.toBeInTheDocument();
    });

    it('renders 50/50 split layout with both panes active', () => {
      const onFocusChange = vi.fn();
      const onSwap = vi.fn();
      const onCloseRight = vi.fn();

      render(
        <SplitPaneLayout
          layoutMode="split-50-50"
          activeFocusPane="left"
          onFocusPaneChange={onFocusChange}
          onSwapPanes={onSwap}
          onCloseRightPane={onCloseRight}
          leftTitle="Overview"
          rightTitle="Stock Analyst"
          leftPane={<div>Left View</div>}
          rightPane={<div>Right View</div>}
        />
      );

      expect(screen.getByLabelText('Overview')).toBeInTheDocument();
      expect(screen.getByLabelText('Stock Analyst')).toBeInTheDocument();

      // Click right pane to change focus
      fireEvent.click(screen.getByLabelText('Stock Analyst'));
      expect(onFocusChange).toHaveBeenCalledWith('right');

      // Click swap button
      const swapButtons = screen.getAllByLabelText('Swap panes');
      fireEvent.click(swapButtons[0]);
      expect(onSwap).toHaveBeenCalled();

      // Click close button
      fireEvent.click(screen.getByLabelText('Close secondary pane'));
      expect(onCloseRight).toHaveBeenCalled();
    });

    it('handles dragover and drop events on pane dropzones', () => {
      const onDrop = vi.fn();

      render(
        <SplitPaneLayout
          layoutMode="split-50-50"
          activeFocusPane="left"
          onDropOnPane={onDrop}
          leftPane={<div>Left View</div>}
          rightPane={<div>Right View</div>}
        />
      );

      const leftSection = screen.getByLabelText('Primary Workspace');
      const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: (type: string) =>
            type === 'application/json'
              ? JSON.stringify({ menuCode: 'research.stock_analyst', route: '/research/stock-analyst' })
              : '',
        },
      };

      fireEvent.drop(leftSection, dropEvent);
      expect(onDrop).toHaveBeenCalledWith('left', 'research.stock_analyst', '/research/stock-analyst');
    });
  });

  describe('BottomNavBar (Mobile Slide 2)', () => {
    it('renders 4 mobile tabs and handles tab navigation and drawer open', () => {
      const onTabChange = vi.fn();
      const onOpenDrawer = vi.fn();

      render(
        <BottomNavBar
          activeTab="overview"
          onTabChange={onTabChange}
          onOpenMenuDrawer={onOpenDrawer}
        />
      );

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Watchlist')).toBeInTheDocument();
      expect(screen.getByText('Analyst')).toBeInTheDocument();
      expect(screen.getByText('Menu')).toBeInTheDocument();

      // Click Watchlist tab
      fireEvent.click(screen.getByText('Watchlist'));
      expect(onTabChange).toHaveBeenCalledWith('watchlist', '/portfolio/watchlist');

      // Click Menu tab (drawer trigger)
      fireEvent.click(screen.getByText('Menu'));
      expect(onOpenDrawer).toHaveBeenCalled();
    });
  });

  describe('ChartContainer', () => {
    it('renders header, title, timeframe pills, and children', () => {
      const onTimeframeChange = vi.fn();

      render(
        <ChartContainer
          title="NAV Equity Curve"
          subtitle="Portfolio vs SPY Benchmark"
          timeframeOptions={['1M', '3M', '1Y', 'ALL']}
          selectedTimeframe="1Y"
          onTimeframeChange={onTimeframeChange}
        >
          <div data-testid="chart-body">Interactive Line Chart</div>
        </ChartContainer>
      );

      expect(screen.getByText('NAV Equity Curve')).toBeInTheDocument();
      expect(screen.getByText('Portfolio vs SPY Benchmark')).toBeInTheDocument();
      expect(screen.getByTestId('chart-body')).toBeInTheDocument();

      // Click timeframe pill
      fireEvent.click(screen.getByText('3M'));
      expect(onTimeframeChange).toHaveBeenCalledWith('3M');
    });

    it('renders loading overlay and error retry state correctly', () => {
      const onRetry = vi.fn();

      const { rerender } = render(
        <ChartContainer title="Test Chart" isLoading={true}>
          <div>Canvas</div>
        </ChartContainer>
      );
      expect(screen.getByText('Updating chart data...')).toBeInTheDocument();

      rerender(
        <ChartContainer title="Test Chart" error="Failed to fetch quotes" onRetry={onRetry}>
          <div>Canvas</div>
        </ChartContainer>
      );
      expect(screen.getByText('Failed to fetch quotes')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Retry'));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('ModalDialog', () => {
    it('renders when isOpen is true, hides when false, and handles close events', () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <ModalDialog
          isOpen={false}
          onClose={onClose}
          title="New Order Ticket"
        >
          <div>Order Form</div>
        </ModalDialog>
      );
      expect(screen.queryByText('New Order Ticket')).not.toBeInTheDocument();

      rerender(
        <ModalDialog
          isOpen={true}
          onClose={onClose}
          title="New Order Ticket"
          description="Submit a cash or margin trade"
        >
          <div>Order Form</div>
        </ModalDialog>
      );

      expect(screen.getByText('New Order Ticket')).toBeInTheDocument();
      expect(screen.getByText('Submit a cash or margin trade')).toBeInTheDocument();

      // Click close button
      fireEvent.click(screen.getByLabelText('Close modal dialog'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('HeatmapGrid', () => {
    it('renders sector items with appropriate color classes and percentage values', () => {
      const onItemClick = vi.fn();
      const mockItems = [
        { id: 'XLK', label: 'Technology', value: 2.45 },
        { id: 'XLE', label: 'Energy', value: -1.2 },
        { id: 'XLF', label: 'Financials', value: 0.0 },
      ];

      render(
        <HeatmapGrid
          items={mockItems}
          onItemClick={onItemClick}
          columns={3}
        />
      );

      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('+2.45%')).toBeInTheDocument();
      expect(screen.getByText('Energy')).toBeInTheDocument();
      expect(screen.getByText('-1.20%')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Technology'));
      expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
    });
  });
});
