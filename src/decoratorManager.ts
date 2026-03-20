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
import { buildTransientBlameLines, hasStructuralLineChange, hasStructuralLineDeletion } from "./transientLineState";
import type { BlameLineInfo, GitAuthorIdentity, GitBlmsConfig } from "./types";

const REFRESH_DELAY_MS = 250;
const COLUMN_HORIZONTAL_PADDING_CH = 0.45;
const COLUMN_MARGIN_RIGHT_CH = 0.25;

export class DecoratorManager implements vscode.Disposable {
  private readonly committedDecorationType = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.OpenClosed
  });
  private readonly uncommittedDecorationType = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.OpenClosed
  });
  private readonly pendingRefreshes = new Map<string, NodeJS.Timeout>();
  private readonly refreshGeneration = new Map<string, number>();
  private readonly skipMessages = new Map<string, string>();
  private readonly renderedBlameLines = new Map<string, BlameLineInfo[]>();
  private readonly renderedLineInfo = new Map<string, Map<number, BlameLineInfo>>();
  private readonly lastAnnotationWidths = new Map<string, number>();
  private readonly currentAuthors = new Map<string, GitAuthorIdentity | undefined>();

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
      this.clearDocumentState(documentKey);
      return;
    }

    const lookup = await this.blameManager.getBlame(editor.document, config);
    if (this.refreshGeneration.get(documentKey) !== generation) {
      return;
    }

    if (lookup.kind === "skip") {
      this.clearEditor(editor);
      this.clearDocumentState(documentKey);
      this.maybeShowSkipReason(editor, lookup.reason, lookup.code);
      return;
    }

    this.skipMessages.delete(documentKey);
    this.renderedBlameLines.set(
      documentKey,
      lookup.blame.lines.map((line) => ({ ...line }))
    );
    this.renderedLineInfo.set(documentKey, createRenderedLineInfo(lookup.blame.lines));
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);
    const annotationWidth = calculateAnnotationWidth(lookup.blame.lines, config, locale, language);
    this.lastAnnotationWidths.set(documentKey, annotationWidth);
    this.currentAuthors.set(documentKey, lookup.blame.currentAuthor);

    const annotationOptions = this.buildDecorationOptions(
      editor.document,
      lookup.blame.lines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      lookup.blame.currentAuthor
    );

    this.setEditorDecorations(editor, annotationOptions);
  }

  scheduleRefresh(
    document: vscode.TextDocument,
    contentChanges: readonly vscode.TextDocumentContentChangeEvent[] = []
  ): void {
    const documentKey = document.uri.toString();
    this.blameManager.invalidateDocument(document);
    const hasLineDeletion = hasStructuralLineDeletion(contentChanges);

    if (!hasLineDeletion && hasStructuralLineChange(contentChanges)) {
      this.applyTransientDecorations(document, contentChanges);
    } else if (hasLineDeletion) {
      this.applyTransientUncommittedDecorations(document, contentChanges);
    }

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
    this.clearDocumentState(key);
  }

  handleConfigurationChanged(): void {
    this.blameManager.clearAll();
    void this.refreshVisibleEditors();
  }

  clearAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearEditor(editor);
    }
    this.renderedBlameLines.clear();
    this.renderedLineInfo.clear();
    this.lastAnnotationWidths.clear();
    this.currentAuthors.clear();
  }

  dispose(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearEditor(editor);
    }
    for (const timeout of this.pendingRefreshes.values()) {
      clearTimeout(timeout);
    }
    this.pendingRefreshes.clear();
    this.committedDecorationType.dispose();
    this.uncommittedDecorationType.dispose();
  }

  getLineInfo(uri: vscode.Uri, lineNumber: number): BlameLineInfo | undefined {
    return this.renderedLineInfo.get(uri.toString())?.get(lineNumber);
  }

  prepareForDelete(editor: vscode.TextEditor | undefined, direction: "left" | "right"): void {
    if (!editor || editor.document.uri.scheme !== "file" || !getExtensionConfig().enabled) {
      return;
    }

    if (!this.shouldPreclearForDelete(editor, direction)) {
      return;
    }

    this.maskUncommittedEditorsForDelete(editor.document);
  }

  private async refreshVisibleEditorsForDocument(uri: vscode.Uri): Promise<void> {
    const visibleEditors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === uri.toString()
    );

    await Promise.all(visibleEditors.map((editor) => this.refreshEditor(editor)));
  }

  private clearEditor(editor: vscode.TextEditor): void {
    editor.setDecorations(this.committedDecorationType, []);
    editor.setDecorations(this.uncommittedDecorationType, []);
  }

  private buildDecorationOptions(
    document: vscode.TextDocument,
    lines: readonly BlameLineInfo[],
    config: GitBlmsConfig,
    locale: string,
    language: ReturnType<typeof resolveDisplayLanguage>,
    annotationWidth: string,
    currentAuthor?: GitAuthorIdentity
  ): { committed: vscode.DecorationOptions[]; uncommitted: vscode.DecorationOptions[] } {
    const committed: vscode.DecorationOptions[] = [];
    const uncommitted: vscode.DecorationOptions[] = [];

    for (const line of lines) {
      const option = this.createDecorationOption(
        document,
        line,
        config,
        locale,
        language,
        annotationWidth,
        currentAuthor
      );

      if (!option) {
        continue;
      }

      if (line.isUncommitted) {
        uncommitted.push(option);
      } else {
        committed.push(option);
      }
    }

    return { committed, uncommitted };
  }

  private applyTransientDecorations(
    document: vscode.TextDocument,
    contentChanges: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    if (!getExtensionConfig().enabled) {
      return;
    }

    const documentKey = document.uri.toString();
    const existingLines = this.renderedBlameLines.get(documentKey);
    if (!existingLines) {
      return;
    }

    const visibleEditors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === documentKey
    );
    if (visibleEditors.length === 0) {
      return;
    }

    const config = getExtensionConfig();
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);
    const transientLines = buildTransientBlameLines(existingLines, contentChanges);
    const annotationWidth = Math.max(
      this.lastAnnotationWidths.get(documentKey) ?? 0,
      calculateAnnotationWidth(transientLines, config, locale, language)
    );
    const currentAuthor = this.currentAuthors.get(documentKey);
    const annotationOptions = this.buildDecorationOptions(
      document,
      transientLines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      currentAuthor
    );

    this.renderedBlameLines.set(
      documentKey,
      transientLines.map((line) => ({ ...line }))
    );
    this.renderedLineInfo.set(documentKey, createRenderedLineInfo(transientLines));
    this.lastAnnotationWidths.set(documentKey, annotationWidth);

    for (const editor of visibleEditors) {
      this.setEditorDecorations(editor, annotationOptions);
    }
  }

  private applyTransientUncommittedDecorations(
    document: vscode.TextDocument,
    contentChanges: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    if (!getExtensionConfig().enabled) {
      return;
    }

    const documentKey = document.uri.toString();
    const existingLines = this.renderedBlameLines.get(documentKey);
    if (!existingLines) {
      return;
    }

    const visibleEditors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === documentKey
    );
    if (visibleEditors.length === 0) {
      return;
    }

    const config = getExtensionConfig();
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);
    const transientLines = buildTransientBlameLines(existingLines, contentChanges);
    const annotationWidth = Math.max(
      this.lastAnnotationWidths.get(documentKey) ?? 0,
      calculateAnnotationWidth(transientLines, config, locale, language)
    );
    const currentAuthor = this.currentAuthors.get(documentKey);
    const annotationOptions = this.buildDecorationOptions(
      document,
      transientLines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      currentAuthor
    );

    this.renderedBlameLines.set(
      documentKey,
      transientLines.map((line) => ({ ...line }))
    );
    this.renderedLineInfo.set(documentKey, createRenderedLineInfo(transientLines));
    this.lastAnnotationWidths.set(documentKey, annotationWidth);

    for (const editor of visibleEditors) {
      editor.setDecorations(this.uncommittedDecorationType, annotationOptions.uncommitted);
    }
  }

  private clearDocumentState(documentKey: string): void {
    this.skipMessages.delete(documentKey);
    this.renderedBlameLines.delete(documentKey);
    this.renderedLineInfo.delete(documentKey);
    this.lastAnnotationWidths.delete(documentKey);
    this.currentAuthors.delete(documentKey);
  }

  private shouldPreclearForDelete(editor: vscode.TextEditor, direction: "left" | "right"): boolean {
    return editor.selections.some((selection) => {
      if (!selection.isEmpty) {
        return selection.start.line !== selection.end.line;
      }

      const position = selection.active;
      if (direction === "left") {
        return position.line > 0 && position.character === 0;
      }

      if (position.line >= editor.document.lineCount - 1) {
        return false;
      }

      const textLine = editor.document.lineAt(position.line);
      return position.character === textLine.text.length;
    });
  }

  private setEditorDecorations(
    editor: vscode.TextEditor,
    options: { committed: vscode.DecorationOptions[]; uncommitted: vscode.DecorationOptions[] }
  ): void {
    editor.setDecorations(this.committedDecorationType, options.committed);
    editor.setDecorations(this.uncommittedDecorationType, options.uncommitted);
  }

  private maskUncommittedEditorsForDelete(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    const lines = this.renderedBlameLines.get(documentKey);
    if (!lines?.some((line) => line.isUncommitted)) {
      return;
    }

    const config = getExtensionConfig();
    const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
    const language = resolveDisplayLanguage(config.language, locale);
    const annotationWidth = formatAnnotationWidth(
      this.lastAnnotationWidths.get(documentKey) ?? calculateAnnotationWidth(lines, config, locale, language)
    );
    const maskedOptions = lines
      .filter((line) => line.isUncommitted)
      .map((line) => this.createMaskedUncommittedDecorationOption(document, line, config, locale, language, annotationWidth))
      .filter((value): value is vscode.DecorationOptions => value !== undefined);

    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === documentKey) {
        editor.setDecorations(this.uncommittedDecorationType, maskedOptions);
      }
    }
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
      config.highlightCurrentAuthor && config.currentAuthorColor.trim() && isCurrentAuthorLine(line, currentAuthor)
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

  private createMaskedUncommittedDecorationOption(
    document: vscode.TextDocument,
    line: BlameLineInfo,
    config: GitBlmsConfig,
    locale: string,
    language: ReturnType<typeof resolveDisplayLanguage>,
    annotationWidth: string
  ): vscode.DecorationOptions | undefined {
    if (!line.isUncommitted || line.lineNumber >= document.lineCount) {
      return undefined;
    }

    const textLine = document.lineAt(line.lineNumber);
    return {
      range: getAnnotationRange(textLine),
      renderOptions: {
        before: {
          contentText: buildUncommittedAnnotationText(config, locale, language),
          color: "rgba(0, 0, 0, 0)",
          backgroundColor: "rgba(0, 0, 0, 0)",
          margin: `0 ${COLUMN_MARGIN_RIGHT_CH}ch 0 0`,
          width: annotationWidth,
          textDecoration: `none; padding: 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch 0.08em ${COLUMN_HORIZONTAL_PADDING_CH}ch; border-left: 3px solid transparent;`
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
): number {
  let maxTextWidth = 0;

  for (const line of lines) {
    const text = line.isUncommitted
      ? buildUncommittedAnnotationText(config, locale, language)
      : buildAnnotationText(line, line.authorTime * 1000, config, locale, language);
    maxTextWidth = Math.max(maxTextWidth, getVisualWidth(text));
  }

  return clamp(maxTextWidth, 0, config.maxAnnotationWidth);
}

function formatAnnotationWidth(value: number): string {
  return `${value.toFixed(1)}ch`;
}

function createRenderedLineInfo(lines: readonly BlameLineInfo[]): Map<number, BlameLineInfo> {
  return new Map(
    lines
      .filter((line) => !line.isUncommitted)
      .map((line) => [line.lineNumber, line])
  );
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
