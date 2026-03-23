import type { DateFormat } from "./types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

// Fixed width for date/time display: 10 display width (English chars = 1, Chinese chars = 2)
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
    return padToFixedDisplayWidth(isChinese ? "刚刚" : "just now", FIXED_TIME_WIDTH);
  }

  if (diffMs >= YEAR_MS) {
    const years = Math.floor(diffMs / YEAR_MS);
    return padToFixedDisplayWidth(formatRelativeUnit(years, isChinese ? "年前" : "y ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= WEEK_MS) {
    const weeks = Math.floor(diffMs / WEEK_MS);
    return padToFixedDisplayWidth(formatRelativeUnit(weeks, isChinese ? "周前" : "w ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= DAY_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return padToFixedDisplayWidth(formatRelativeUnit(days, isChinese ? "天前" : "d ago", isChinese), FIXED_TIME_WIDTH);
  }

  if (diffMs >= HOUR_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return padToFixedDisplayWidth(formatRelativeUnit(hours, isChinese ? "小时前" : "h ago", isChinese), FIXED_TIME_WIDTH);
  }

  const minutes = Math.floor(diffMs / MINUTE_MS);
  return padToFixedDisplayWidth(formatRelativeUnit(minutes, isChinese ? "分钟前" : "m ago", isChinese), FIXED_TIME_WIDTH);
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
 * Calculate the display width of a string.
 * East Asian Fullwidth characters count as 2, ASCII as 1.
 */
export function getVisualWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += isWideCharacter(char) ? 2 : 1;
  }
  return width;
}

/**
 * Check if a character is a wide (East Asian Fullwidth) character.
 */
export function isWideCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

/**
 * Pad a string to a fixed display width by adding trailing spaces.
 * Display width: East Asian Fullwidth = 2, ASCII = 1.
 */
function padToFixedDisplayWidth(text: string, targetWidth: number): string {
  const currentWidth = getVisualWidth(text);
  if (currentWidth >= targetWidth) {
    return text;
  }
  const spaceCount = targetWidth - currentWidth;
  return text + " ".repeat(spaceCount);
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
