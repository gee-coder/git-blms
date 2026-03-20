import type { DisplayLanguage } from "./types";

export type ResolvedLanguage = "zh-CN" | "en";

type TranslationKey =
  | "annotation.uncommitted"
  | "annotation.unknownAuthor"
  | "hover.author"
  | "hover.time"
  | "hover.hash"
  | "hover.summary"
  | "hover.noSummary"
  | "hover.viewDetails"
  | "hover.uncommitted"
  | "message.noCommitInfo"
  | "message.uncommittedNoDetails"
  | "message.readCommitFailed"
  | "skip.notFile"
  | "skip.notInRepo"
  | "skip.readBlameFailed";

const TRANSLATIONS: Record<ResolvedLanguage, Record<TranslationKey, string>> = {
  "zh-CN": {
    "annotation.uncommitted": "未提交",
    "annotation.unknownAuthor": "未知作者",
    "hover.author": "提交者",
    "hover.time": "提交时间",
    "hover.hash": "提交哈希",
    "hover.summary": "提交信息",
    "hover.noSummary": "(无提交标题)",
    "hover.viewDetails": "查看提交详情",
    "hover.uncommitted": "尚未提交的修改",
    "message.noCommitInfo": "当前光标所在行暂无可查看的提交信息。",
    "message.uncommittedNoDetails": "当前行为未提交的修改，暂时没有提交详情。",
    "message.readCommitFailed": "读取提交详情失败。",
    "skip.notFile": "GitBlms 只支持本地磁盘上的文件。",
    "skip.notInRepo": "当前文件不在 Git 仓库中。",
    "skip.readBlameFailed": "读取 Git blame 失败。"
  },
  en: {
    "annotation.uncommitted": "Uncommitted",
    "annotation.unknownAuthor": "Unknown Author",
    "hover.author": "Author",
    "hover.time": "Committed At",
    "hover.hash": "Commit Hash",
    "hover.summary": "Summary",
    "hover.noSummary": "(no commit summary)",
    "hover.viewDetails": "View Commit Details",
    "hover.uncommitted": "Uncommitted changes",
    "message.noCommitInfo": "No commit details are available for the current line.",
    "message.uncommittedNoDetails": "The current line is uncommitted and has no commit details yet.",
    "message.readCommitFailed": "Failed to read commit details.",
    "skip.notFile": "GitBlms only supports files on the local filesystem.",
    "skip.notInRepo": "The current file is not inside a Git repository.",
    "skip.readBlameFailed": "Failed to read Git blame."
  }
};

export function resolveDisplayLanguage(configuredLanguage: DisplayLanguage, locale: string): ResolvedLanguage {
  if (configuredLanguage !== "auto") {
    return configuredLanguage;
  }

  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function t(language: ResolvedLanguage, key: TranslationKey): string {
  return TRANSLATIONS[language][key];
}

export function formatTooLargeSkipReason(
  language: ResolvedLanguage,
  lineCount: number,
  maxLineCount: number
): string {
  if (language === "zh-CN") {
    return `当前文件共有 ${lineCount} 行，已超过 git-blms.maxLineCount (${maxLineCount})。`;
  }

  return `The current file has ${lineCount} lines, which exceeds git-blms.maxLineCount (${maxLineCount}).`;
}
