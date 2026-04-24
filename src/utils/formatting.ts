// Formatting utilities for Openspacemarin
// Requirements: 4.6

/**
 * Formats a currency value with K/M/B/T abbreviations.
 * - < 1,000: integer (e.g., "999")
 * - ≥ 1,000: K suffix with 1 decimal, trailing ".0" removed (e.g., "1.5K", "2K")
 * - ≥ 1,000,000: M suffix
 * - ≥ 1,000,000,000: B suffix
 * - ≥ 1,000,000,000,000: T suffix
 *
 * @param value - Non-negative number to format
 * @returns Formatted string
 */
export function formatCurrency(value: number): string {
  const thresholds: Array<{ limit: number; suffix: string }> = [
    { limit: 1_000_000_000_000, suffix: 'T' },
    { limit: 1_000_000_000, suffix: 'B' },
    { limit: 1_000_000, suffix: 'M' },
    { limit: 1_000, suffix: 'K' },
  ];

  for (const { limit, suffix } of thresholds) {
    if (value >= limit) {
      const abbreviated = (value / limit).toFixed(1);
      // Remove trailing ".0" (e.g., "2.0" → "2")
      const trimmed = abbreviated.endsWith('.0')
        ? abbreviated.slice(0, -2)
        : abbreviated;
      return `${trimmed}${suffix}`;
    }
  }

  // For values < 1000: always show as integer (used for currency balances)
  return Math.floor(value).toString();
}

/**
 * Formats a generation rate value, preserving up to 2 decimal places.
 * Unlike formatCurrency, this shows fractional values (e.g., "1.25", "0.25").
 *
 * @param value - Generation rate to format
 * @returns Formatted string with up to 2 decimals
 */
export function formatGeneration(value: number): string {
  if (value === 0) return '0';
  const fixed = value.toFixed(2).replace(/\.?0+$/, '');
  return fixed;
}

/**
 * Formats play time (in ticks) as a human-readable duration string.
 * Examples: "2h 30m", "45m", "1h", "0m"
 *
 * @param ticks              - Number of ticks elapsed
 * @param tickIntervalSeconds - Real seconds per tick (1, 3, or 5)
 * @returns Formatted time string
 */
export function formatTime(ticks: number, tickIntervalSeconds: number): string {
  const totalSeconds = ticks * tickIntervalSeconds;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Formats a bonus percentage value as "+X%" for achievement display.
 *
 * @param value - Bonus percentage value (e.g., 5 for +5%)
 * @returns Formatted string like "+5%"
 */
export function formatPercent(value: number): string {
  return `+${value}%`;
}
