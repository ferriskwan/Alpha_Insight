/**
 * Global test environment setup for Vitest and React Testing Library.
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfill window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill HTMLCanvasElement getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: [] }),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Polyfill scrollTo
window.scrollTo = vi.fn();

// Mock lightweight-charts for headless JSDOM environments
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addCandlestickSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
      setMarkers: vi.fn(),
      applyOptions: vi.fn(),
    }),
    addLineSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
      applyOptions: vi.fn(),
    }),
    addHistogramSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
      applyOptions: vi.fn(),
    }),
    timeScale: vi.fn().mockReturnValue({
      fitContent: vi.fn(),
      setVisibleRange: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
}));
