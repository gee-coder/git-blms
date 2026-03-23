import { spawn } from "node:child_process";
import * as path from "node:path";
import type { ResolvedLanguage } from "./i18n";
import type { BlameLineInfo, BlameResult, GitAuthorIdentity } from "./types";

interface GitCommandResult {
  stdout: string;
  stderr: string;
}

interface GetBlameOptions {
  repoRoot?: string;
  contents?: string;
}

export class GitService {
  private readonly repoRootCache = new Map<string, Promise<string | undefined>>();
  private readonly currentAuthorCache = new Map<string, Promise<GitAuthorIdentity | undefined>>();
  private readonly headHashCache = new Map<string, { hash: string; expiresAt: number }>();

  async resolveRepoRoot(filePath: string): Promise<string | undefined> {
    const directory = path.dirname(filePath);
    const cached = this.repoRootCache.get(directory);
    if (cached) {
      return cached;
    }

    const pending = this.runGitCommand(["rev-parse", "--show-toplevel"], directory)
      .then(({ stdout }) => stdout.trim() || undefined)
      .catch(() => undefined);

    this.repoRootCache.set(directory, pending);
    return pending;
  }

  async getBlame(filePath: string, options: GetBlameOptions = {}): Promise<BlameResult | undefined> {
    const repoRoot = options.repoRoot ?? (await this.resolveRepoRoot(filePath));
    if (!repoRoot) {
      return undefined;
    }

    const relativePath = normalizeGitPath(path.relative(repoRoot, filePath));
    const args = ["blame", "--line-porcelain"];

    if (options.contents !== undefined) {
      args.push("--contents", "-", "--", relativePath);
    } else {
      args.push("--", relativePath);
    }

    const [commandResult, currentAuthor] = await Promise.all([
      this.runGitCommand(args, repoRoot, options.contents),
      this.getCurrentAuthorForRepo(repoRoot)
    ]);

    return {
      repoRoot,
      filePath,
      lines: parseBlamePorcelain(commandResult.stdout),
      generatedAt: Date.now(),
      fromDirtyContent: options.contents !== undefined,
      currentAuthor
    };
  }

  async getCommitDetails(filePath: string, commitHash: string, language: ResolvedLanguage = "en"): Promise<string> {
    const repoRoot = await this.resolveRepoRoot(filePath);
    if (!repoRoot) {
      throw new Error(
        language === "zh-CN"
          ? "当前文件不在 Git 仓库中。"
          : "The current file is not inside a Git repository."
      );
    }

    const { stdout } = await this.runGitCommand(
      ["show", "--stat", "--decorate", "--format=fuller", commitHash],
      repoRoot
    );

    return stdout;
  }

  clearCaches(): void {
    this.repoRootCache.clear();
    this.currentAuthorCache.clear();
    this.headHashCache.clear();
  }

  /**
   * Get the current HEAD commit hash for a repository.
   * Results are cached for 1 second to optimize performance.
   */
  async getHeadHash(repoRoot: string): Promise<string | undefined> {
    const now = Date.now();
    const cached = this.headHashCache.get(repoRoot);

    if (cached && cached.expiresAt > now) {
      return cached.hash;
    }

    try {
      const { stdout } = await this.runGitCommand(["rev-parse", "HEAD"], repoRoot);
      const hash = stdout.trim();

      if (hash) {
        // Cache for 1 second
        this.headHashCache.set(repoRoot, { hash, expiresAt: now + 1000 });
        return hash;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async getCurrentAuthorForRepo(repoRoot: string): Promise<GitAuthorIdentity | undefined> {
    const cached = this.currentAuthorCache.get(repoRoot);
    if (cached) {
      return cached;
    }

    const pending = Promise.all([
      this.readGitConfigValue(repoRoot, "user.name"),
      this.readGitConfigValue(repoRoot, "user.email")
    ]).then(([name, email]) => {
      if (!name && !email) {
        return undefined;
      }

      return { name, email };
    });

    this.currentAuthorCache.set(repoRoot, pending);
    return pending;
  }

  private runGitCommand(args: string[], cwd: string, stdinText?: string): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd,
        stdio: "pipe",
        windowsHide: true
      });

      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(new Error(stderr.trim() || `git ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
      });

      if (stdinText !== undefined) {
        child.stdin.write(stdinText);
      }

      child.stdin.end();
    });
  }

  private async readGitConfigValue(cwd: string, key: string): Promise<string | undefined> {
    try {
      const { stdout } = await this.runGitCommand(["config", "--get", key], cwd);
      const value = stdout.trim();
      return value || undefined;
    } catch {
      return undefined;
    }
  }
}

export function parseBlamePorcelain(output: string): BlameLineInfo[] {
  const entries: BlameLineInfo[] = [];
  const metadataCache = new Map<string, Omit<BlameLineInfo, "lineNumber">>();
  const lines = output.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const header = lines[index]?.trim();
    if (!header) {
      index += 1;
      continue;
    }

    const match = /^(\^?[0-9a-f]{40}|0{40})\s+\d+\s+(\d+)(?:\s+\d+)?$/i.exec(header);
    if (!match) {
      throw new Error(`无法解析 git blame 输出：${header}`);
    }

    const commitHash = match[1].replace(/^\^/, "");
    const lineNumber = Number(match[2]) - 1;
    index += 1;

    const base =
      metadataCache.get(commitHash) ??
      {
        commitHash,
        shortCommitHash: commitHash.slice(0, 7),
        author: "",
        authorMail: "",
        authorTime: 0,
        summary: "",
        isUncommitted: commitHash === "0000000000000000000000000000000000000000"
      };

    while (index < lines.length && !lines[index].startsWith("\t")) {
      const currentLine = lines[index];
      const separatorIndex = currentLine.indexOf(" ");
      const key = separatorIndex === -1 ? currentLine : currentLine.slice(0, separatorIndex);
      const value = separatorIndex === -1 ? "" : currentLine.slice(separatorIndex + 1);

      switch (key) {
        case "author":
          base.author = value;
          base.isUncommitted ||= value === "Not Committed Yet";
          break;
        case "author-mail":
          base.authorMail = value;
          break;
        case "author-time":
          base.authorTime = Number(value) || 0;
          break;
        case "summary":
          base.summary = value;
          break;
        default:
          break;
      }

      index += 1;
    }

    metadataCache.set(commitHash, { ...base });
    entries.push({
      lineNumber,
      ...base
    });

    if (index < lines.length && lines[index].startsWith("\t")) {
      index += 1;
    }
  }

  return entries.sort((left, right) => left.lineNumber - right.lineNumber);
}

function normalizeGitPath(value: string): string {
  return value.split(path.sep).join("/");
}
