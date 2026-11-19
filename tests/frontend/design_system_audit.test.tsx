/**
 * UAT-006: Verification tests for Centralized Design System & Zero Hardcoding Audit.
 */

import './setup';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

import { DESIGN_TOKENS } from '../../frontend/src/design-system/tokens';
import {
  BentoCard,
  AccordionCard,
  PillToggle,
  SegmentedControl,
  Button,
  MetricCard,
  ResponsiveTable,
  Badge,
} from '../../frontend/src/design-system';

describe('UAT-006: Design System Token & Zero-Hardcoding Audit', () => {
  it('contains Option 2: Bento Modular Dark 8 core palette colors in DESIGN_TOKENS', () => {
    const { colors } = DESIGN_TOKENS;

    expect(colors.canvas.toUpperCase()).toBe('#090D16');
    expect(colors.bentoCard.toUpperCase()).toBe('#111827');
    expect(colors.surfaceElevated.toUpperCase()).toBe('#1E293B');
    expect(colors.accentPrimary.toUpperCase()).toBe('#38BDF8');
    expect(colors.accentAi.toUpperCase()).toBe('#818CF8');
    expect(colors.semanticPositive.toUpperCase()).toBe('#34D399');
    expect(colors.semanticNegative.toUpperCase()).toBe('#FB7185');
    expect(colors.semanticWarning.toUpperCase()).toBe('#FBBF24');
  });

  it('scans all frontend/src/components/ files asserting ZERO hardcoded rogue hex colors and ZERO localhost URLs', () => {
    const componentsDir = path.resolve(__dirname, '../../frontend/src/components');
    expect(fs.existsSync(componentsDir)).toBe(true);

    const collectedFiles: string[] = [];

    function collectSourceFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectSourceFiles(fullPath);
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          collectedFiles.push(fullPath);
        }
      }
    }

    collectSourceFiles(componentsDir);
    expect(collectedFiles.length).toBeGreaterThan(5);

    const hexColorRegex = /#[0-9A-Fa-f]{3,8}\b/g;
    const localhostRegex = /https?:\/\/(localhost|127\.0\.0\.1)/g;

    // Design system approved color tokens (paper palette and classic bento)
    const APPROVED_PALETTE = new Set([
      '#FBFBFC', '#FFFFFF', '#F8FAFC', '#E2E8F0', '#F1F5F9', '#CBD5E1', '#2563EB',
      '#0F172A', '#334155', '#475569', '#94A3B8', '#1D4ED8', '#047857', '#B91C1C',
      '#D97706', '#64748B', '#090D16', '#111827', '#1E293B', '#38BDF8', '#818CF8',
      '#34D399', '#FB7185', '#FBBF24', '#0284C7', '#7C3AED',
    ]);

    const hexViolations: { file: string; match: string }[] = [];
    const localhostViolations: { file: string; match: string }[] = [];

    for (const filePath of collectedFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hexMatches = content.match(hexColorRegex);
      if (hexMatches) {
        for (const m of hexMatches) {
          if (!APPROVED_PALETTE.has(m.toUpperCase())) {
            hexViolations.push({ file: path.basename(filePath), match: m });
          }
        }
      }

      const localMatches = content.match(localhostRegex);
      if (localMatches) {
        for (const m of localMatches) {
          localhostViolations.push({ file: path.basename(filePath), match: m });
        }
      }
    }

    expect(hexViolations).toEqual([]);
    expect(localhostViolations).toEqual([]);
  });

  describe('Design System Primitives Rendering', () => {
    it('renders BentoCard with title, subtitle, and body children', () => {
      render(
        <BentoCard title="Portfolio KPI" subtitle="Daily Snapshot">
          <span data-testid="bento-content">Card Body</span>
        </BentoCard>
      );

      expect(screen.getByText('Portfolio KPI')).toBeInTheDocument();
      expect(screen.getByText('Daily Snapshot')).toBeInTheDocument();
      expect(screen.getByTestId('bento-content')).toBeInTheDocument();
    });

    it('renders AccordionCard and toggles expand/collapse state on click', () => {
      render(
        <AccordionCard title="Analysis Modules" summaryBadge="5 Selected" defaultExpanded={true}>
          <div data-testid="accordion-inner">Expandable Body</div>
        </AccordionCard>
      );

      expect(screen.getByText('Analysis Modules')).toBeInTheDocument();
      expect(screen.getByTestId('accordion-inner')).toBeInTheDocument();

      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      // When collapsed, summary badge is displayed
      expect(screen.getByText('5 Selected')).toBeInTheDocument();
    });

    it('renders PillToggle and triggers onClick', () => {
      const handleClick = vi.fn();
      const { rerender } = render(
        <PillToggle label="Technical (30D)" active={false} onClick={handleClick} />
      );

      const pill = screen.getByRole('button', { name: /Technical \(30D\)/i });
      expect(pill).toBeInTheDocument();
      fireEvent.click(pill);
      expect(handleClick).toHaveBeenCalledTimes(1);

      rerender(<PillToggle label="Technical (30D)" active={true} onClick={handleClick} />);
      expect(pill).toBeInTheDocument();
    });

    it('renders SegmentedControl and invokes onChange when selection changes', () => {
      const handleSelect = vi.fn();
      render(
        <SegmentedControl
          options={[
            { value: 'matplotlib', label: 'Matplotlib (charting.py)' },
            { value: 'canvas', label: 'Interactive Canvas' },
            { value: 'split', label: 'Split Compare' },
          ]}
          value="matplotlib"
          onChange={handleSelect}
        />
      );

      expect(screen.getByText('Matplotlib (charting.py)')).toBeInTheDocument();
      const canvasBtn = screen.getByText('Interactive Canvas');
      fireEvent.click(canvasBtn);
      expect(handleSelect).toHaveBeenCalledWith('canvas');
    });

    it('renders Button with variants and handles loading state', () => {
      render(
        <Button variant="primary" loading={true}>
          Analyze Symbol
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(screen.getByText('Analyze Symbol')).toBeInTheDocument();
    });

    it('renders MetricCard with label, value, and positive trend direction', () => {
      render(
        <MetricCard
          label="Total Equity"
          value="$125,400.00"
          subtext="+2.4% Today"
          trend="up"
          trendValue="+2.4%"
          variant="positive"
        />
      );

      expect(screen.getByText('Total Equity')).toBeInTheDocument();
      expect(screen.getByText('$125,400.00')).toBeInTheDocument();
      expect(screen.getByText('+2.4% Today')).toBeInTheDocument();
    });

    it('renders ResponsiveTable with column headers and row data', () => {
      interface MockRow {
        id: number;
        symbol: string;
        price: number;
      }

      const rows: MockRow[] = [
        { id: 1, symbol: 'AAPL', price: 187.5 },
        { id: 2, symbol: 'MSFT', price: 420.0 },
      ];

      render(
        <ResponsiveTable<MockRow>
          columns={[
            { key: 'symbol', header: 'Symbol', render: (r) => r.symbol },
            { key: 'price', header: 'Last Price', render: (r) => `$${r.price.toFixed(2)}` },
          ]}
          data={rows}
          keyExtractor={(r) => r.id}
        />
      );

      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$187.50').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$420.00').length).toBeGreaterThan(0);
    });

    it('renders Badge with semantic styles', () => {
      render(<Badge variant="positive">Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });
});
