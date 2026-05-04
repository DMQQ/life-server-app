import * as dayjs from 'dayjs';

export interface SeriesRecurrenceConfig {
  repeatType: string; // 'DAILY' | 'WEEKLY' | 'MONTHLY'
  repeatInterval: number; // every N days/weeks/months
  repeatDaysOfWeek: string | null; // comma-separated: "0,1,2,3,4,5,6" (0=Sun)
  repeatUntil: string | null; // YYYY-MM-DD, null = infinite
}

/**
 * Parse repeatDaysOfWeek string into a Set of day numbers.
 * e.g., "1,3,5" => Set {1, 3, 5}
 */
function parseDaysOfWeek(daysOfWeek: string | null): Set<number> {
  if (!daysOfWeek) return new Set();
  return new Set(
    daysOfWeek
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 6),
  );
}

/**
 * Generate all occurrence dates for a series within a date range.
 *
 * @param config  - The series recurrence configuration
 * @param anchorDate - The first occurrence date (YYYY-MM-DD)
 * @param fromDate - Start of query range (YYYY-MM-DD)
 * @param toDate - End of query range (YYYY-MM-DD)
 * @returns Array of { date, position } sorted by date
 */
export function expandSeriesDates(
  config: SeriesRecurrenceConfig,
  anchorDate: string,
  fromDate: string,
  toDate: string,
): Array<{ date: string; position: number }> {
  const repeatType = config.repeatType || 'DAILY';
  const interval = config.repeatInterval || 1;

  switch (repeatType) {
    case 'WEEKLY':
      return expandWeekly(config, anchorDate, fromDate, toDate, interval);
    case 'MONTHLY':
      return expandMonthly(anchorDate, fromDate, toDate, interval);
    case 'DAILY':
    default:
      return expandDaily(config, anchorDate, fromDate, toDate, interval);
  }
}

function expandDaily(
  config: SeriesRecurrenceConfig,
  anchorDate: string,
  fromDate: string,
  toDate: string,
  interval: number,
): Array<{ date: string; position: number }> {
  const results: Array<{ date: string; position: number }> = [];
  const anchor = dayjs(anchorDate);
  const from = dayjs(fromDate);
  const to = dayjs(toDate);
  const until = config.repeatUntil ? dayjs(config.repeatUntil) : null;

  // Start from anchor, step forward by interval days
  let current = anchor;
  let position = 0;

  // Hard cap: 50 years from anchor to prevent infinite loops
  const hardCap = anchor.add(50, 'year');

  while (current.isBefore(hardCap)) {
    if (until && current.isAfter(until, 'day')) break;

    if (
      (current.isSame(from, 'day') || current.isAfter(from, 'day')) &&
      (current.isSame(to, 'day') || current.isBefore(to, 'day'))
    ) {
      results.push({ date: current.format('YYYY-MM-DD'), position });
    }

    position++;
    current = current.add(interval, 'day');
  }

  return results;
}

function expandWeekly(
  config: SeriesRecurrenceConfig,
  anchorDate: string,
  fromDate: string,
  toDate: string,
  interval: number,
): Array<{ date: string; position: number }> {
  const results: Array<{ date: string; position: number }> = [];
  const daysOfWeek = parseDaysOfWeek(config.repeatDaysOfWeek);
  const anchor = dayjs(anchorDate);
  const from = dayjs(fromDate);
  const to = dayjs(toDate);
  const until = config.repeatUntil ? dayjs(config.repeatUntil) : null;

  // If no days of week specified, use the anchor's day of week
  const targetDays = daysOfWeek.size > 0 ? daysOfWeek : new Set([anchor.day()]);

  // Find the start of the first week containing fromDate
  // Walk forward from anchor, week by week
  let weekStart = anchor.startOf('week'); // Sunday
  let position = 0;
  const hardCap = anchor.add(50, 'year');

  while (weekStart.isBefore(hardCap)) {
    for (const dayNum of targetDays) {
      const date = weekStart.add(dayNum, 'day');
      if (date.isBefore(anchor, 'day')) continue; // Don't generate before anchor
      if (until && date.isAfter(until, 'day')) continue;

      if (
        (date.isSame(from, 'day') || date.isAfter(from, 'day')) &&
        (date.isSame(to, 'day') || date.isBefore(to, 'day'))
      ) {
        results.push({ date: date.format('YYYY-MM-DD'), position });
      }
      position++;
    }
    weekStart = weekStart.add(interval, 'week');
  }

  // Sort by date and reassign positions
  results.sort((a, b) => a.date.localeCompare(b.date));
  results.forEach((r, i) => (r.position = i));

  return results;
}

function expandMonthly(
  anchorDate: string,
  fromDate: string,
  toDate: string,
  interval: number,
): Array<{ date: string; position: number }> {
  const results: Array<{ date: string; position: number }> = [];
  const anchor = dayjs(anchorDate);
  const from = dayjs(fromDate);
  const to = dayjs(toDate);

  // For monthly, we use the anchor's day-of-month and nth-weekday pattern
  const anchorDay = anchor.date(); // day of month
  const anchorWeekday = anchor.day(); // weekday

  let current = anchor;
  let position = 0;
  const hardCap = anchor.add(50, 'year');

  while (current.isBefore(hardCap)) {
    // Calculate the occurrence: same day-of-month OR same nth-weekday
    let date = current;

    // If anchor's day-of-month is > 28, use nth-weekday pattern to handle
    // cases like "last Monday of month"
    if (anchorDay > 28) {
      // nth weekday pattern: same weekday of the same occurrence in the month
      date = getNthWeekdayOfMonth(
        current.year(),
        current.month(),
        anchorWeekday,
        getNthOccurrence(anchor),
      );
    } else {
      // Simple day-of-month: clamp to month length
      const daysInMonth = current.daysInMonth();
      const d = Math.min(anchorDay, daysInMonth);
      date = current.date(d);
    }

    if (date.isBefore(anchor, 'day')) {
      current = current.add(interval, 'month');
      continue;
    }

    if (
      (date.isSame(from, 'day') || date.isAfter(from, 'day')) &&
      (date.isSame(to, 'day') || date.isBefore(to, 'day'))
    ) {
      results.push({ date: date.format('YYYY-MM-DD'), position });
    }

    position++;
    current = anchor.add(position * interval, 'month');
  }

  return results;
}

/**
 * Get the nth occurrence number of a given date's weekday in that month.
 * e.g., If date is the 2nd Tuesday of the month, returns 2.
 */
function getNthOccurrence(date: dayjs.Dayjs): number {
  return Math.ceil(date.date() / 7);
}

/**
 * Get the date of the nth occurrence of a weekday in a given month.
 * e.g., getNthWeekdayOfMonth(2026, 5, 2, 2) = 2nd Tuesday of May 2026.
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): dayjs.Dayjs {
  const firstOfMonth = dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`);
  const firstWeekday = firstOfMonth.day();
  const diff = (weekday - firstWeekday + 7) % 7;
  const firstTarget = firstOfMonth.add(diff, 'day');
  const result = firstTarget.add((n - 1) * 7, 'day');

  // If result is in next month, use the last occurrence in this month
  if (result.month() !== month) {
    return result.subtract(7, 'day');
  }
  return result;
}

/**
 * Check if a series has an occurrence on a specific date.
 */
export function seriesHasOccurrenceOnDate(
  config: SeriesRecurrenceConfig,
  anchorDate: string,
  date: string,
): boolean {
  const results = expandSeriesDates(config, anchorDate, date, date);
  return results.length > 0;
}
