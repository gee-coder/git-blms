import { isCurrentAuthorLine } from "./authorIdentity";
import * as vscode from "vscode";
import { BlameManager } from "./blameManager";
import { COMMAND_OPEN_COMMIT_DETAILS, getExtensionConfig } from "./config";
import {
  calculateAnnotationBackground,
  calculateAnnotationBorder,
  calculateAnnotationColor,
  calculateCurrentAuthorAnnotationBackground,
  calculateCurrentAuthorAnnotationBorder,
  calculateCurrentAuthorAnnotationColor,
  calculateUncommittedAnnotationBackground,
  calculateUncommittedAnnotationBorder,
  calculateUncommittedAnnotationColor
} from "./colorCalculator";
import { resolveDisplayLanguage, t } from "./i18n";
import { formatCompactTimestamp, formatFullDateTime } from "./relativeTime";
import type { BlameLineInfo, GitAuthorIdentity, GitBlmsConfig } from "./types";

const REFRESH_DELAY_MS = 250;
const COLUMN_HORIZONTAL_PADDING_CH = 0.45;
const COLUMN_MARGIN_RIGHT_CH = 0.25;

export class DecoratorManager implements vscode.Disposable {
  private readonly annotationDecorationType = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });
  private readonly pendingRefreshes = new Map<string, NodeJS.Timeout>();
  private readonly refreshGeneration = new Map<string, number>();
  private readonly skipMessages = new Map<string, string>();
  private readonly renderedLineInfo = new Map<string, Map<number, BlameLineInfo>>();

  constructor(private readonly blameManager: BlameManager) {}

  async refreshVisibleEditors(): Promise<void> {
    await Promise.all(vscode.window.visibleTextEditors.map((editor) => this.refreshEditor(editor)));
  }

  async refreshEditor(editor?: vscode.TextEditor): Promise<void> {
    if (!editor || editor.document.uri.scheme !== "file") {
      return;
    }

    const config = getExtensionConfig();
    const documentKey = editor.document.uri.toString();
    const generation = (this.refreshGeneration.get(documentKey) ?? 0) + 1;
    this.refreshGeneration.set(documentKey, generation);

    if (!config.enabled) {
      this.clearEditor(editor);
      return;
    }

    const lookup = await this.blameManager.getBlame(editor.document, config);
    if (this.refreshGeneration.get(documentKey) !== generation) {
      return;
    }

    if (lookup.kind === "skip") {
      this.clearEditor(editor);
      this.renderedLineInfo.delete(documentKey);
      this.maybeShowSkipReason(editor, lookup.reason, lookup.code);
      return;
    }

    this.skipMessages.delete(documentKey);
    this.renderedLineInfo.set(
      documentKey,
      new Map(
        lookup.blame.lines
          .filter((line) => !line.isUncommitted)
          .map((line) => [line.lineNumber, line])
      )
    );
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);
    const annotationWidth = calculateAnnotationWidth(lookup.blame.lines, config, locale, language);

    const annotationOptions = lookup.blame.lines
      .map((line) =>
        this.createDecorationOption(
          editor.document,
          line,
          config,
          locale,
          language,
          annotationWidth,
          lookup.blame.currentAuthor
        )
      )
      .filter((value): value is vscode.DecorationOptions => value !== undefined);

    editor.setDecorations(this.annotationDecorationType, annotationOptions);
  }

  scheduleRefresh(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    this.blameManager.invalidateDocument(document);

    const pending = this.pendingRefreshes.get(documentKey);
    if (pending) {
      clearTimeout(pending);
    }

    const timeout = setTimeout(() => {
      this.pendingRefreshes.delete(documentKey);
      void this.refreshVisibleEditorsForDocument(document.uri);
    }, REFRESH_DELAY_MS);

    this.pendingRefreshes.set(documentKey, timeout);
  }

  handleDocumentSaved(document: vscode.TextDocument): void {
    this.blameManager.invalidateDocument(document);
    void this.refreshVisibleEditorsForDocument(document.uri);
  }

  handleDocumentClosed(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const pending = this.pendingRefreshes.get(key);
    if (pending) {
      clearTimeout(pending);
      this.pendingRefreshes.delete(key);
    }
    this.skipMessages.delete(key);
    this.refreshGeneration.delete(key);
    this.renderedLineInfo.delete(key);
  }

  handleConfigurationChanged(): void {
    this.blameManager.clearAll();
    void this.refreshVisibleEditors();
  }

  clearAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearEditor(editor);
    }
    this.renderedLineInfo.clear();
  }

  dispose(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearEditor(editor);
    }
    for (const timeout of this.pendingRefreshes.values()) {
      clearTimeout(timeout);
    }
    this.pendingRefreshes.clear();
    this.annotationDecorationType.dispose();
  }

  getLineInfo(uri: vscode.Uri, lineNumber: number): BlameLineInfo | undefined {
    return this.renderedLineInfo.get(uri.toString())?.get(lineNumber);
  }

  private async refreshVisibleEditorsForDocument(uri: vscode.Uri): Promise<void> {
    const visibleEditors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === uri.toString()
    );

    await Promise.all(visibleEditors.map((editor) => this.refreshEditor(editor)));
  }

  private clearEditor(editor: vscode.TextEditor): void {
    editor.setDecorations(this.annotationDecorationType, []);
  }

  private createDecorationOption(
    document: vscode.TextDocument,
    line: BlameLineInfo,
    config: GitBlmsConfig,
    locale: string,
    language: ReturnType<typeof resolveDisplayLanguage>,
    annotationWidth: string,
    currentAuthor?: GitAuthorIdentity
  ): vscode.DecorationOptions | undefined {
    if (line.lineNumber >= document.lineCount) {
      return undefined;
    }

    const textLine = document.lineAt(line.lineNumber);
    const range = getAnnotationRange(textLine);
    const timestampMs = line.authorTime * 1000;

    if (line.isUncommitted) {
      return {
        range,
        renderOptions: {
          before: {
            contentText: buildUncommittedAnnotationText(config, locale, language),
            color: calculateUncommittedAnnotationColor(config.uncommittedColor),
            backgroundColor: calculateUncommittedAnnotationBackground(config.uncommittedColor),
            margin: `0 ${COLUMN_MARGIN_RIGHT_CH}ch 0 0`,
            width: annotationWidth,
            textDecoration: `none; padding: 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch; border-left: 3px solid ${calculateUncommittedAnnotationBorder(
              config.uncommittedColor
            )};`
          }
        }
      };
    }

    const isCurrentAuthor = Boolean(
      config.currentAuthorColor.trim() && isCurrentAuthorLine(line, currentAuthor)
    );
    const annotationColor = isCurrentAuthor
      ? calculateCurrentAuthorAnnotationColor(timestampMs, config.currentAuthorColor)
      : calculateAnnotationColor(timestampMs, config.colorScheme);
    const annotationBackground = isCurrentAuthor
      ? calculateCurrentAuthorAnnotationBackground(timestampMs, config.currentAuthorColor)
      : calculateAnnotationBackground(timestampMs, config.colorScheme);
    const annotationBorder = isCurrentAuthor
      ? calculateCurrentAuthorAnnotationBorder(timestampMs, config.currentAuthorColor)
      : calculateAnnotationBorder(timestampMs, config.colorScheme);

    return {
      range,
      hoverMessage: buildHoverMessage(document.uri, line, language),
      renderOptions: {
        before: {
          contentText: buildAnnotationText(line, timestampMs, config, locale, language),
          color: annotationColor,
          backgroundColor: annotationBackground,
          margin: `0 ${COLUMN_MARGIN_RIGHT_CH}ch 0 0`,
          width: annotationWidth,
          textDecoration: `none; padding: 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch; border-left: 3px solid ${annotationBorder};`
        }
      }
    };
  }

  private maybeShowSkipReason(
    editor: vscode.TextEditor,
    reason: string,
    code: "not-file" | "not-in-repo" | "too-large" | "git-error"
  ): void {
    if (editor !== vscode.window.activeTextEditor) {
      return;
    }

    if (code === "not-file" || code === "not-in-repo") {
      return;
    }

    const documentKey = editor.document.uri.toString();
    if (this.skipMessages.get(documentKey) === reason) {
      return;
    }

    this.skipMessages.set(documentKey, reason);
    void vscode.window.setStatusBarMessage(`GitBlms: ${reason}`, 5000);
  }
}

function getAnnotationRange(textLine: vscode.TextLine): vscode.Range {
  return new vscode.Range(textLine.range.start, textLine.range.start);
}

function buildAnnotationText(
  line: BlameLineInfo,
  timestampMs: number,
  config: GitBlmsConfig,
  locale: string,
  language: ReturnType<typeof resolveDisplayLanguage>
): string {
  const dateText = formatCompactTimestamp(timestampMs, config.dateFormat, locale);
  const authorText = truncateAuthor(line.author, language);
  return `${dateText}  ${authorText}`;
}

function buildUncommittedAnnotationText(
  config: GitBlmsConfig,
  locale: string,
  language: ReturnType<typeof resolveDisplayLanguage>
): string {
  const dateText = formatCompactTimestamp(Date.now(), config.dateFormat, locale);
  return `${dateText}  ${t(language, "annotation.uncommitted")}`;
}

function buildHoverMessage(
  documentUri: vscode.Uri,
  line: BlameLineInfo,
  language: ReturnType<typeof resolveDisplayLanguage>
): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString(undefined, true);
  markdown.isTrusted = true;
  markdown.appendMarkdown(
    `**${t(language, "hover.author")}**: ${escapeMarkdown(line.author)} ${escapeMarkdown(line.authorMail)}  \n`
  );
  markdown.appendMarkdown(`**${t(language, "hover.time")}**: ${formatFullDateTime(line.authorTime * 1000)}  \n`);
  markdown.appendMarkdown(`**${t(language, "hover.hash")}**: \`${line.shortCommitHash}\`  \n`);
  markdown.appendMarkdown(
    `**${t(language, "hover.summary")}**: ${escapeMarkdown(line.summary || t(language, "hover.noSummary"))}  \n`
  );

  if (!line.isUncommitted) {
    const commandArgs = encodeURIComponent(JSON.stringify([documentUri.toString(), line.commitHash]));
    markdown.appendMarkdown(
      `[${t(language, "hover.viewDetails")}](command:${COMMAND_OPEN_COMMIT_DETAILS}?${commandArgs})`
    );
  } else {
    markdown.appendMarkdown(`_${t(language, "hover.uncommitted")}_`);
  }

  return markdown;
}

function truncateAuthor(author: string, language: ReturnType<typeof resolveDisplayLanguage>): string {
  const trimmed = author.trim();
  if (!trimmed) {
    return t(language, "annotation.unknownAuthor");
  }

  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}…` : trimmed;
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}

function calculateAnnotationWidth(
  lines: BlameLineInfo[],
  config: GitBlmsConfig,
  locale: string,
  language: ReturnType<typeof resolveDisplayLanguage>
): string {
  let maxTextWidth = 0;

  for (const line of lines) {
    const text = line.isUncommitted
      ? buildUncommittedAnnotationText(config, locale, language)
      : buildAnnotationText(line, line.authorTime * 1000, config, locale, language);
    maxTextWidth = Math.max(maxTextWidth, getVisualWidth(text));
  }

  const finalWidth = clamp(maxTextWidth, 0, config.maxAnnotationWidth);
  return `${finalWidth.toFixed(1)}ch`;
}

function getVisualWidth(value: string): number {
  let width = 0;

  for (const char of value) {
    width += isWideCharacter(char) ? 2 : 1;
  }

  return width;
}

function isWideCharacter(char: string): boolean {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
