import * as fs from "node:fs/promises";
import * as vscode from "vscode";
import { GitService } from "./gitService";
import { formatTooLargeSkipReason, resolveDisplayLanguage, t } from "./i18n";
import type { BlameLookupResult, BlameResult, GitBlmsConfig } from "./types";

interface CacheEntry {
  expiresAt: number;
  value: BlameResult;
}

export class BlameManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<BlameLookupResult>>();

  constructor(private readonly gitService: GitService) {}

  async getBlame(document: vscode.TextDocument, config: GitBlmsConfig): Promise<BlameLookupResult> {
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);

    if (document.uri.scheme !== "file") {
      return {
        kind: "skip",
        code: "not-file",
        reason: t(language, "skip.notFile")
      };
    }

    if (document.lineCount > config.maxLineCount) {
      return {
        kind: "skip",
        code: "too-large",
        reason: formatTooLargeSkipReason(language, document.lineCount, config.maxLineCount)
      };
    }

    const cacheKey = await this.createCacheKey(document);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { kind: "ok", blame: cached.value };
    }

    const pending = this.inflight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const promise = this.loadBlame(document, config, cacheKey, language).finally(() => {
      this.inflight.delete(cacheKey);
    });

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  invalidateDocument(document: vscode.TextDocument | vscode.Uri): void {
    const target = document instanceof vscode.Uri ? document.toString() : document.uri.toString();
    for (const key of this.cache.keys()) {
      if (key.startsWith(target)) {
        this.cache.delete(key);
      }
    }
  }

  clearAll(): void {
    this.cache.clear();
    this.inflight.clear();
    this.gitService.clearCaches();
  }

  private async loadBlame(
    document: vscode.TextDocument,
    config: GitBlmsConfig,
    cacheKey: string,
    language: ReturnType<typeof resolveDisplayLanguage>
  ): Promise<BlameLookupResult> {
    try {
      const blame = await this.gitService.getBlame(document.uri.fsPath, {
        contents: document.isDirty ? document.getText() : undefined
      });

      if (!blame) {
        return {
          kind: "skip",
          code: "not-in-repo",
          reason: t(language, "skip.notInRepo")
        };
      }

      this.cache.set(cacheKey, {
        expiresAt: Date.now() + config.cacheTimeout,
        value: blame
      });

      return {
        kind: "ok",
        blame
      };
    } catch (error) {
      return {
        kind: "skip",
        code: "git-error",
        reason: error instanceof Error ? error.message : t(language, "skip.readBlameFailed")
      };
    }
  }

  private async createCacheKey(document: vscode.TextDocument): Promise<string> {
    const base = document.uri.toString();

    if (document.isDirty) {
      // Dirty files: use document version, don't need HEAD hash
      return `${base}::dirty::${document.version}`;
    }

    try {
      const stats = await fs.stat(document.uri.fsPath);

      // For saved files, try to get HEAD hash for cache invalidation
      const repoRoot = await this.gitService.resolveRepoRoot(document.uri.fsPath);
      const headHash = repoRoot ? await this.gitService.getHeadHash(repoRoot) : undefined;

      if (headHash) {
        return `${base}::saved::${stats.mtimeMs}::${headHash}`;
      }

      // Fallback if HEAD cannot be retrieved (e.g., not in git repo yet)
      return `${base}::saved::${stats.mtimeMs}::no-head`;
    } catch {
      return `${base}::saved::${document.version}::no-head`;
    }
  }
}
