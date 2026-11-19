/**
 * Date formatting utility for AlphaInsight financial ledgers.
 * Formats dates strictly as DD-Mon-YYYY (e.g., 08-Jul-2026), omitting any time component.
 */

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/**
 * Formats an ISO string, YYYY-MM-DD date, or Date object into DD-Mon-YYYY format.
 * Employs direct string extraction to prevent local/UTC timezone day-shifting.
 *
 * @param dateInput - Raw date string (e.g. "2026-07-08T00:00:00") or Date object
 * @returns Formatted string (e.g. "08-Jul-2026") or "—" if empty/invalid
 */
export function formatTradeDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) {
    return '—';
  }

  // Handle Date objects
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '—';
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = SHORT_MONTHS[dateInput.getMonth()];
    const year = dateInput.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '—';

  // Direct regex match for YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    const day = isoMatch[3].padStart(2, '0');
    const month = SHORT_MONTHS[monthIndex];
    if (month) {
      return `${day}-${month}-${year}`;
    }
  }

  // Fallback to Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = SHORT_MONTHS[parsed.getMonth()];
    const year = parsed.getFullYear();
    if (month) {
      return `${day}-${month}-${year}`;
    }
  }

  return str;
}
