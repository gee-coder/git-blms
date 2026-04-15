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
import { formatCompactTimestamp, formatFullDateTime, getVisualWidth, isWideCharacter } from "./relativeTime";
import { buildTransientBlameLines, hasStructuralLineChange, hasStructuralLineDeletion } from "./transientLineState";
import type { BlameLineInfo, GitAuthorIdentity, GitBlmsConfig } from "./types";

const REFRESH_DELAY_MS = 250;
const COLUMN_HORIZONTAL_PADDING_CH = 0.45;
const COLUMN_MARGIN_RIGHT_CH = 0.25;

// Annotation width constants
const TIME_DISPLAY_WIDTH = 10;  // Fixed width for time display
const SEPARATOR_WIDTH = 2;       // Width of separator between time and username
const DEFAULT_MAX_ANNOTATION_WIDTH = 22;  // Default max annotation width from config

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
  private readonly lastUsernameWidths = new Map<string, number>();
  private readonly currentAuthors = new Map<string, GitAuthorIdentity | undefined>();
  // Cache for gutter decoration types by color
  private readonly gutterDecorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  // Two independent display toggles
  private gutterEnabled = true;
  private annotationEnabled = true;

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

    // Calculate username display width based on config and actual usernames
    const usernameDisplayWidth = calculateUsernameDisplayWidth(lookup.blame.lines, config.maxAnnotationWidth);
    const annotationWidth = calculateAnnotationWidth(lookup.blame.lines, config, locale, language, usernameDisplayWidth);

    this.lastAnnotationWidths.set(documentKey, annotationWidth);
    this.lastUsernameWidths.set(documentKey, usernameDisplayWidth);
    this.currentAuthors.set(documentKey, lookup.blame.currentAuthor);

    const annotationOptions = this.buildDecorationOptions(
      editor.document,
      lookup.blame.lines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      usernameDisplayWidth,
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

    // Only apply transient decorations when at least one display feature is enabled
    if (this.gutterEnabled || this.annotationEnabled) {
      if (!hasLineDeletion && hasStructuralLineChange(contentChanges)) {
        this.applyTransientDecorations(document, contentChanges);
      } else if (hasLineDeletion) {
        this.applyTransientUncommittedDecorations(document, contentChanges);
      }
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
      // Clear gutter decorations
      for (const decorationType of this.gutterDecorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
    }
    this.renderedBlameLines.clear();
    this.renderedLineInfo.clear();
    this.lastAnnotationWidths.clear();
    this.lastUsernameWidths.clear();
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
    // Dispose all gutter decoration types
    for (const decorationType of this.gutterDecorationTypes.values()) {
      decorationType.dispose();
    }
    this.gutterDecorationTypes.clear();
  }

  getLineInfo(uri: vscode.Uri, lineNumber: number): BlameLineInfo | undefined {
    return this.renderedLineInfo.get(uri.toString())?.get(lineNumber);
  }

  /**
   * Set whether gutter decorations are shown.
   * @param enabled - Whether to show gutter decorations
   */
  setGutterEnabled(enabled: boolean): void {
    this.gutterEnabled = enabled;
    void this.refreshVisibleEditors();
  }

  /**
   * Set whether inline annotations are shown.
   * @param enabled - Whether to show inline annotations
   */
  setAnnotationEnabled(enabled: boolean): void {
    this.annotationEnabled = enabled;
    void this.refreshVisibleEditors();
  }

  /**
   * Get whether gutter decorations are enabled.
   */
  isGutterEnabled(): boolean {
    return this.gutterEnabled;
  }

  /**
   * Get whether inline annotations are enabled.
   */
  isAnnotationEnabled(): boolean {
    return this.annotationEnabled;
  }

  /**
   * Get or create a gutter decoration type for the specified color.
   * @param color - Hex color string (e.g., "#ff0000")
   * @returns TextEditorDecorationType with gutter icon configured
   */
  private getOrCreateGutterDecorationType(color: string): vscode.TextEditorDecorationType {
    if (!this.gutterDecorationTypes.has(color)) {
      const gutterIcon = getColorIndicator(color);
      this.gutterDecorationTypes.set(
        color,
        vscode.window.createTextEditorDecorationType({
          gutterIconPath: vscode.Uri.parse(gutterIcon),
          gutterIconSize: "12px"
        })
      );
    }
    return this.gutterDecorationTypes.get(color)!;
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
    usernameDisplayWidth: number,
    currentAuthor?: GitAuthorIdentity
  ): {
    committed: vscode.DecorationOptions[];
    uncommitted: vscode.DecorationOptions[];
    gutterByColor: Map<string, vscode.DecorationOptions[]>
  } {
    const committed: vscode.DecorationOptions[] = [];
    const uncommitted: vscode.DecorationOptions[] = [];
    const gutterByColor = new Map<string, vscode.DecorationOptions[]>();

    for (const line of lines) {
      const option = this.createDecorationOption(
        document,
        line,
        config,
        locale,
        language,
        annotationWidth,
        usernameDisplayWidth,
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

      // Group gutter decorations by color
      const color = calculateGutterIconColor(line, config, locale, currentAuthor);
      if (!gutterByColor.has(color)) {
        gutterByColor.set(color, []);
      }
      gutterByColor.get(color)!.push({
        range: option.range
      });
    }

    return { committed, uncommitted, gutterByColor };
  }

  private applyTransientDecorations(
    document: vscode.TextDocument,
    contentChanges: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
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

    // Use stored username width to keep layout stable during editing
    const usernameDisplayWidth = this.lastUsernameWidths.get(documentKey) ??
      calculateUsernameDisplayWidth(existingLines, config.maxAnnotationWidth);
    const annotationWidth = Math.max(
      this.lastAnnotationWidths.get(documentKey) ?? 0,
      calculateAnnotationWidth(transientLines, config, locale, language, usernameDisplayWidth)
    );

    const currentAuthor = this.currentAuthors.get(documentKey);
    const annotationOptions = this.buildDecorationOptions(
      document,
      transientLines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      usernameDisplayWidth,
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

    // Use stored username width to keep layout stable during editing
    const usernameDisplayWidth = this.lastUsernameWidths.get(documentKey) ??
      calculateUsernameDisplayWidth(existingLines, config.maxAnnotationWidth);
    const annotationWidth = Math.max(
      this.lastAnnotationWidths.get(documentKey) ?? 0,
      calculateAnnotationWidth(transientLines, config, locale, language, usernameDisplayWidth)
    );

    const currentAuthor = this.currentAuthors.get(documentKey);
    const annotationOptions = this.buildDecorationOptions(
      document,
      transientLines,
      config,
      locale,
      language,
      formatAnnotationWidth(annotationWidth),
      usernameDisplayWidth,
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
    this.lastUsernameWidths.delete(documentKey);
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
    options: {
      committed: vscode.DecorationOptions[];
      uncommitted: vscode.DecorationOptions[];
      gutterByColor: Map<string, vscode.DecorationOptions[]>
    }
  ): void {
    // Set gutter decorations if enabled
    if (this.gutterEnabled) {
      for (const [color, decorations] of options.gutterByColor) {
        const decorationType = this.getOrCreateGutterDecorationType(color);
        editor.setDecorations(decorationType, decorations);
      }
    } else {
      // Clear all gutter decorations if disabled
      for (const [color, decorationType] of this.gutterDecorationTypes) {
        editor.setDecorations(decorationType, []);
      }
    }

    // Clear any gutter decorations that are no longer needed
    const usedColors = new Set(options.gutterByColor.keys());
    for (const [color, decorationType] of this.gutterDecorationTypes) {
      if (!usedColors.has(color)) {
        editor.setDecorations(decorationType, []);
      }
    }

    // Set inline decorations based on annotation enabled state
    if (this.annotationEnabled) {
      editor.setDecorations(this.committedDecorationType, options.committed);
      editor.setDecorations(this.uncommittedDecorationType, options.uncommitted);
    } else {
      // Clear inline decorations if disabled
      editor.setDecorations(this.committedDecorationType, []);
      editor.setDecorations(this.uncommittedDecorationType, []);
    }
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

    const usernameDisplayWidth = this.lastUsernameWidths.get(documentKey) ??
      calculateUsernameDisplayWidth(lines, config.maxAnnotationWidth);
    const annotationWidth = formatAnnotationWidth(
      this.lastAnnotationWidths.get(documentKey) ??
        calculateAnnotationWidth(lines, config, locale, language, usernameDisplayWidth)
    );

    const maskedOptions = lines
      .filter((line) => line.isUncommitted)
      .map((line) => this.createMaskedUncommittedDecorationOption(document, line, config, locale, language, annotationWidth, usernameDisplayWidth))
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
    usernameDisplayWidth: number,
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
            contentText: buildUncommittedAnnotationText(config, locale, language, usernameDisplayWidth),
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
          contentText: buildAnnotationText(line, timestampMs, config, locale, language, usernameDisplayWidth),
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
    annotationWidth: string,
    usernameDisplayWidth: number
  ): vscode.DecorationOptions | undefined {
    if (!line.isUncommitted || line.lineNumber >= document.lineCount) {
      return undefined;
    }

    const textLine = document.lineAt(line.lineNumber);

    return {
      range: getAnnotationRange(textLine),
      renderOptions: {
        before: {
          contentText: buildUncommittedAnnotationText(config, locale, language, usernameDisplayWidth),
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
  language: ReturnType<typeof resolveDisplayLanguage>,
  usernameDisplayWidth: number
): string {
  const dateText = formatCompactTimestamp(timestampMs, config.dateFormat, locale);
  const authorText = formatUsername(line.author, language, usernameDisplayWidth);
  return `${dateText}  ${authorText}`;
}

function buildUncommittedAnnotationText(
  config: GitBlmsConfig,
  locale: string,
  language: ReturnType<typeof resolveDisplayLanguage>,
  usernameDisplayWidth: number
): string {
  const dateText = formatCompactTimestamp(Date.now(), config.dateFormat, locale);
  const uncommittedText = t(language, "annotation.uncommitted");
  // Format "Uncommitted" text to the same width as username
  const formattedUncommitted = truncateAndPadToDisplayWidth(uncommittedText, usernameDisplayWidth);
  return `${dateText}  ${formattedUncommitted}`;
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

/**
 * Calculate the display width for usernames based on maxAnnotationWidth and actual username lengths.
 * @param lines - The blame lines to analyze
 * @param maxAnnotationWidth - The configured maximum annotation width
 * @returns The calculated username display width
 */
function calculateUsernameDisplayWidth(lines: BlameLineInfo[], maxAnnotationWidth: number): number {
  const fixedWidth = TIME_DISPLAY_WIDTH + SEPARATOR_WIDTH;
  let maxUsernameWidth = maxAnnotationWidth - fixedWidth;

  // Invalid value check - use default when result is too small
  if (maxUsernameWidth < 2) {
    maxUsernameWidth = DEFAULT_MAX_ANNOTATION_WIDTH - fixedWidth; // 10
  }

  // Find the longest username display width, excluding uncommitted lines.
  // Uncommitted lines from git blame have author "Not Committed Yet" (16 chars),
  // but are displayed as "未提交"/"Uncommitted" which is much shorter.
  // Including them would inflate the annotation width unnecessarily.
  const actualMaxUsername = lines.reduce((max, line) => {
    if (line.isUncommitted) {
      return max;
    }
    const width = getVisualWidth(line.author.trim());
    return Math.max(max, width);
  }, 0);

  // Ensure minimum width for uncommitted text display ("未提交" = 6, "Uncommitted" = 10)
  const effectiveMaxUsername = Math.max(actualMaxUsername, 6);

  // Return the smaller of max allowed and effective longest
  return Math.min(maxUsernameWidth, effectiveMaxUsername);
}

/**
 * Format username to a dynamic display width.
 * - Truncate with single ellipsis `…` if needed
 * - Pad with spaces if shorter
 */
function formatUsername(author: string, language: ReturnType<typeof resolveDisplayLanguage>, displayWidth: number): string {
  const trimmed = author.trim();
  if (!trimmed) {
    // Unknown author - translate then pad to width
    const unknown = t(language, "annotation.unknownAuthor");
    return truncateAndPadToDisplayWidth(unknown, displayWidth);
  }

  return truncateAndPadToDisplayWidth(trimmed, displayWidth);
}

/**
 * Truncate text to a target display width and pad with spaces.
 * Chinese characters count as 2, English as 1.
 * Uses single ellipsis `…` (1 display width) for truncation.
 */
function truncateAndPadToDisplayWidth(text: string, targetWidth: number): string {
  const displayWidth = getVisualWidth(text);

  if (displayWidth <= targetWidth) {
    // Pad with spaces to reach target width
    const spaceCount = targetWidth - displayWidth;
    return text + " ".repeat(spaceCount);
  }

  // Need to truncate - calculate how much to keep
  // We need targetWidth - 1 for the ellipsis
  const contentWidth = targetWidth - 1;
  let keptWidth = 0;
  let keptText = "";

  for (const char of text) {
    const charWidth = isWideCharacter(char) ? 2 : 1;
    if (keptWidth + charWidth > contentWidth) {
      break;
    }
    keptText += char;
    keptWidth += charWidth;
  }

  return keptText + "…";
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}

function calculateAnnotationWidth(
  lines: BlameLineInfo[],
  config: GitBlmsConfig,
  locale: string,
  language: ReturnType<typeof resolveDisplayLanguage>,
  usernameDisplayWidth?: number
): number {
  // Calculate username width if not provided
  const width = usernameDisplayWidth ?? calculateUsernameDisplayWidth(lines, config.maxAnnotationWidth);

  // Total width = time (10) + separator (2) + username (dynamic)
  const totalWidth = TIME_DISPLAY_WIDTH + SEPARATOR_WIDTH + width;

  return Math.min(totalWidth, config.maxAnnotationWidth);
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

// Gutter color indicator cache
const colorIndicatorCache = new Map<string, string>();

/**
 * Create a color indicator SVG Data URI for gutter decoration.
 * @param color - Hex color string (e.g., "#ff0000")
 * @returns SVG Data URI string
 */
function createColorIndicator(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
    <rect width="12" height="12" fill="${color}" rx="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Get color indicator SVG Data URI with caching.
 * @param color - Hex color string
 * @returns SVG Data URI string
 */
function getColorIndicator(color: string): string {
  if (!colorIndicatorCache.has(color)) {
    colorIndicatorCache.set(color, createColorIndicator(color));
  }
  return colorIndicatorCache.get(color)!;
}

/**
 * Calculate gutter icon color for a blame line based on commit info and config.
 * @param line - Blame line information
 * @param config - Extension configuration
 * @param locale - Locale for date formatting
 * @param currentAuthor - Current git author identity
 * @returns Hex color string for the gutter icon
 */
function calculateGutterIconColor(
  line: BlameLineInfo,
  config: GitBlmsConfig,
  locale: string,
  currentAuthor?: GitAuthorIdentity
): string {
  const timestampMs = line.authorTime * 1000;

  if (line.isUncommitted) {
    return calculateUncommittedAnnotationBackground(config.uncommittedColor);
  }

  const isCurrentAuthor = Boolean(
    config.highlightCurrentAuthor &&
    config.currentAuthorColor.trim() &&
    isCurrentAuthorLine(line, currentAuthor)
  );

  return isCurrentAuthor
    ? calculateCurrentAuthorAnnotationBackground(timestampMs, config.currentAuthorColor)
    : calculateAnnotationBackground(timestampMs, config.colorScheme);
}
