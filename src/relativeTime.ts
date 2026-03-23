import type { DateFormat } from "./types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

// Fixed width for date/time display: 10 characters
const FIXED_TIME_WIDTH = 10;

export function formatCompactTimestamp(
  timestampMs: number,
  dateFormat: DateFormat,
  locale: string,
  now = Date.now()
): string {
  if (dateFormat === "absolute") {
    return formatAbsoluteDate(timestampMs);
  }

  return formatRelativeTime(timestampMs, locale, now);
}

export function formatRelativeTime(timestampMs: number, locale: string, now = Date.now()): string {
  const diffMs = Math.max(0, now - timestampMs);
  const isChinese = locale.toLowerCase().startsWith("zh");

  if (diffMs < MINUTE_MS) {
    return padToFixedWidth(isChinese ? "刚刚" : "just now", FIXED_TIME_WIDTH);
  }

  if (diffMs >= YEAR_MS) {
    const years = Math.floor(diffMs / YEAR_MS);
    return padToFixedWidth(formatRelativeUnit(years, isChinese ? "年前" : "y ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= WEEK_MS) {
    const weeks = Math.floor(diffMs / WEEK_MS);
    return padToFixedWidth(formatRelativeUnit(weeks, isChinese ? "周前" : "w ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= DAY_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return padToFixedWidth(formatRelativeUnit(days, isChinese ? "天前" : "d ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= HOUR_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return padToFixedWidth(formatRelativeUnit(hours, isChinese ? "小时前" : "h ago", isChinese), FIXED_TIME_WIDTH);
  }

  const minutes = Math.floor(diffMs / MINUTE_MS);
  return padToFixedWidth(formatRelativeUnit(minutes, isChinese ? "分钟前" : "m ago", isChinese), FIXED_TIME_WIDTH);
}

function formatRelativeUnit(value: number, suffix: string, isChinese: boolean): string {
  if (isChinese) {
    return `${value}${suffix}`;
  }
  return `${value}${suffix}`;
}

export function formatFullDateTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Format date as yyyy/mm/dd with zero-padded month and day.
 * Fixed width: 10 characters.
 */
export function formatAbsoluteDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}/${month}/${day}`;
}

/**
 * Pad a string to a fixed width by adding trailing spaces.
 * For Chinese text, this uses character count (not display width).
 */
function padToFixedWidth(text: string, width: number): string {
  return text.padEnd(width, " ");
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
