/**
 * UAT / Frontend Tests for White Paper Aesthetic & Design System Tokens.
 *
 * Covers:
 * - Aptos font family token definition in DESIGN_TOKENS and Tailwind config
 * - Paper theme colors (canvas, surface, borders, ink text, institutional accents)
 * - High-contrast chart palette tokens for printed report readability
 */

import './setup';
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { DESIGN_TOKENS } from '../../frontend/src/design-system/tokens';

describe('White Paper Design System & Aptos Typography', () => {
  describe('Typography Tokens', () => {
    it('defines Aptos as the primary sans font family token', () => {
      const { typography } = DESIGN_TOKENS;
      expect(typography).toBeDefined();
      expect(typography.fontSans).toContain('Aptos');
      expect(typography.fontDisplay).toContain('Aptos');
    });

    it('ensures Tailwind configuration includes Aptos in fontFamily extensions', () => {
      const tailwindConfigPath = path.resolve(__dirname, '../../frontend/tailwind.config.js');
      expect(fs.existsSync(tailwindConfigPath)).toBe(true);

      const content = fs.readFileSync(tailwindConfigPath, 'utf-8');
      expect(content).toContain('Aptos');
      expect(content).toContain('fontFamily');
      expect(content).toMatch(/sans:\s*\[.*Aptos/);
    });
  });

  describe('Paper Aesthetic Color Palette', () => {
    it('defines institutional paper palette tokens in DESIGN_TOKENS.paper', () => {
      const { paper } = DESIGN_TOKENS;
      expect(paper).toBeDefined();

      // Canvas / Surface clean white and off-white
      expect(paper.canvas.toUpperCase()).toBe('#FBFBFC');
      expect(paper.surface.toUpperCase()).toBe('#FFFFFF');
      expect(paper.paper.toUpperCase()).toBe('#FFFFFF');

      // Borders
      expect(paper.border.toUpperCase()).toBe('#E2E8F0');
      expect(paper.borderActive.toUpperCase()).toBe('#2563EB');

      // Ink typography
      expect(paper.textPrimary.toUpperCase()).toBe('#0F172A');
      expect(paper.textSecondary.toUpperCase()).toBe('#334155');

      // High-contrast semantic accents
      expect(paper.accentBlue.toUpperCase()).toBe('#1D4ED8');
      expect(paper.accentGreen.toUpperCase()).toBe('#047857');
      expect(paper.accentRed.toUpperCase()).toBe('#B91C1C');
      expect(paper.accentAmber.toUpperCase()).toBe('#D97706');
    });

    it('defines high-contrast chart palette in DESIGN_TOKENS.chartHighContrast', () => {
      const { chartHighContrast } = DESIGN_TOKENS;
      expect(chartHighContrast).toBeDefined();

      expect(chartHighContrast.background.toUpperCase()).toBe('#FFFFFF');
      expect(chartHighContrast.upColor.toUpperCase()).toBe('#047857');
      expect(chartHighContrast.downColor.toUpperCase()).toBe('#B91C1C');
      expect(chartHighContrast.sma30.toUpperCase()).toBe('#1D4ED8');
    });

    it('ensures Tailwind config extends paper color definitions', () => {
      const tailwindConfigPath = path.resolve(__dirname, '../../frontend/tailwind.config.js');
      const content = fs.readFileSync(tailwindConfigPath, 'utf-8');

      expect(content).toContain('paper:');
      expect(content).toContain('#FBFBFC');
      expect(content).toContain('#FFFFFF');
      expect(content).toContain('#0F172A');
      expect(content).toContain('#1D4ED8');
    });
  });
});
