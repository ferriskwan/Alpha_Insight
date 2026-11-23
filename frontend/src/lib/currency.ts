/**
 * Shared currency formatting and inference utilities for multi-currency ledgers.
 */

export const CURRENCY_PREFIX_MAP: Record<string, string> = {
  USD: '$',
  SGD: 'S$',
  HKD: 'HK$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
};

/**
 * Return the display currency prefix for a 3-letter ISO currency code.
 */
export function getCurrencyPrefix(currency: string | null | undefined): string {
  const ccy = (currency || 'USD').trim().toUpperCase();
  return CURRENCY_PREFIX_MAP[ccy] ?? `${ccy} `;
}

/**
 * Infer currency code from explicit currency, watchlist map, or ticker exchange suffix.
 */
export function inferSymbolCurrency(
  symbol: string | null | undefined,
  explicitCurrency?: string | null,
  watchlistCurrencyMap?: Map<string, string>
): string {
  if (explicitCurrency && explicitCurrency.trim()) {
    return explicitCurrency.trim().toUpperCase();
  }
  const cleanSym = (symbol || '').trim().toUpperCase();
  const wlCcy = watchlistCurrencyMap?.get(cleanSym);
  if (wlCcy) return wlCcy;
  if (cleanSym.endsWith('.SI')) return 'SGD';
  if (cleanSym.endsWith('.HK')) return 'HKD';
  return 'USD';
}

/**
 * Return Tailwind badge styling classes for a currency pill.
 */
export function getCurrencyBadgeClasses(currency: string | null | undefined): string {
  const ccy = (currency || 'USD').trim().toUpperCase();
  if (ccy === 'SGD') return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (ccy === 'HKD') return 'bg-amber-50 text-amber-800 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}
