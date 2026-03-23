import test from "node:test";
import assert from "node:assert/strict";
import { formatCompactTimestamp, formatFullDateTime, formatRelativeTime } from "../relativeTime";

const NOW = new Date("2026-03-19T12:00:00Z").getTime();

test("formatRelativeTime uses just now for sub-minute timestamps", () => {
  const result = formatRelativeTime(NOW - 30_000, "zh-CN", NOW);
  // New format: fixed 10 chars with padding
  assert.equal(result, "刚刚        ");
});

test("formatRelativeTime uses minutes ago for minute-level timestamps", () => {
  const result = formatRelativeTime(NOW - 5 * 60 * 1000, "zh-CN", NOW);
  assert.equal(result, "5分钟前      ");
});

test("formatRelativeTime uses hours ago for hour-level timestamps", () => {
  const result = formatRelativeTime(NOW - 3 * 60 * 60 * 1000, "zh-CN", NOW);
  assert.equal(result, "3小时前      ");
});

test("formatRelativeTime uses days ago for day-level timestamps", () => {
  const result = formatRelativeTime(NOW - 24 * 60 * 60 * 1000, "zh-CN", NOW);
  // New format: "1天前" instead of "昨天"
  assert.equal(result, "1天前       ");
});

test("formatRelativeTime uses weeks ago for week-level timestamps", () => {
  const result = formatRelativeTime(NOW - 45 * 24 * 60 * 60 * 1000, "zh-CN", NOW);
  // New format: "6周前" instead of "02-02"
  assert.equal(result, "6周前       ");
});

test("formatCompactTimestamp supports absolute dates with zero-padding", () => {
  const result = formatCompactTimestamp(new Date("2026-03-01T00:00:00Z").getTime(), "absolute", "zh-CN", NOW);
  // New format: zero-padded month and day
  assert.equal(result, "2026/03/01");
});

test("formatCompactTimestamp uses short format for English locale", () => {
  const result = formatRelativeTime(NOW - 5 * 60 * 60 * 1000, "en", NOW);
  assert.equal(result, "5h ago    ");
});

test("formatFullDateTime returns a stable YYYY-MM-DD HH:mm:ss string", () => {
  const result = formatFullDateTime(new Date("2026-03-01T08:09:10Z").getTime());
  assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});
