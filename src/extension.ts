import * as vscode from "vscode";
import { BlameManager } from "./blameManager";
import {
  affectsGitBlmsConfiguration,
  COMMAND_HIDE_BLAME,
  COMMAND_OPEN_COMMIT_DETAILS,
  COMMAND_SHOW_BLAME,
  COMMAND_TOGGLE_BLAME,
  getExtensionConfig,
  setEnabled,
  updateEnabledContext
} from "./config";
import { DecoratorManager } from "./decoratorManager";
import { GitService } from "./gitService";
import { resolveDisplayLanguage, t } from "./i18n";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("GitBlms");
  const gitService = new GitService();
  const blameManager = new BlameManager(gitService);
  const decoratorManager = new DecoratorManager(blameManager);

  context.subscriptions.push(outputChannel, decoratorManager);

  const registerCommand = (command: string, callback: (...args: unknown[]) => unknown): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  registerCommand(COMMAND_TOGGLE_BLAME, async () => {
    await setEnabled(!getExtensionConfig().enabled);
  });

  registerCommand(COMMAND_SHOW_BLAME, async () => {
    if (!getExtensionConfig().enabled) {
      await setEnabled(true);
    }
  });

  registerCommand(COMMAND_HIDE_BLAME, async () => {
    if (getExtensionConfig().enabled) {
      await setEnabled(false);
    }
  });

  registerCommand(COMMAND_OPEN_COMMIT_DETAILS, async (...args: unknown[]) => {
    const language = getResolvedLanguage();
    const resolution = resolveCommitRequest(args, decoratorManager);
    if (!resolution) {
      void vscode.window.showInformationMessage(t(language, "message.noCommitInfo"));
      return;
    }

    if (resolution.commitHash === "0000000000000000000000000000000000000000") {
      void vscode.window.showInformationMessage(t(language, "message.uncommittedNoDetails"));
      return;
    }

    try {
      const details = await gitService.getCommitDetails(
        resolution.filePath,
        resolution.commitHash,
        language
      );
      outputChannel.clear();
      outputChannel.appendLine(`# ${resolution.commitHash.slice(0, 7)}`);
      outputChannel.appendLine("");
      outputChannel.appendLine(details.trim());
      outputChannel.show(true);
    } catch (error) {
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : t(language, "message.readCommitFailed")
      );
    }
  });

  void registerDeleteCommandProxy(context, decoratorManager, "deleteLeft", "default:deleteLeft", "left");
  void registerDeleteCommandProxy(context, decoratorManager, "deleteRight", "default:deleteRight", "right");

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void decoratorManager.refreshEditor(editor);
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      void decoratorManager.refreshVisibleEditors();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      decoratorManager.scheduleRefresh(event.document, event.contentChanges);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      decoratorManager.handleDocumentSaved(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      decoratorManager.handleDocumentClosed(document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!affectsGitBlmsConfiguration(event)) {
        return;
      }

      const enabled = getExtensionConfig().enabled;
      void updateEnabledContext(enabled);

      if (!enabled) {
        decoratorManager.clearAllEditors();
        blameManager.clearAll();
        return;
      }

      decoratorManager.handleConfigurationChanged();
    })
  );

  void initialize(decoratorManager);
}

export function deactivate(): void {}

async function initialize(decoratorManager: DecoratorManager): Promise<void> {
  const enabled = getExtensionConfig().enabled;
  await updateEnabledContext(enabled);

  if (enabled) {
    await decoratorManager.refreshVisibleEditors();
  }
}

function resolveCommitRequest(
  args: unknown[],
  decoratorManager: DecoratorManager
): { filePath: string; commitHash: string } | undefined {
  if (args.length >= 2) {
    const uriValue = toUri(args[0]);
    const commitHash = typeof args[1] === "string" ? args[1] : undefined;
    if (uriValue && commitHash) {
      return {
        filePath: uriValue.fsPath,
        commitHash
      };
    }
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || activeEditor.document.uri.scheme !== "file") {
    return undefined;
  }

  const lineNumber = activeEditor.selection.active.line;
  const lineInfo = decoratorManager.getLineInfo(activeEditor.document.uri, lineNumber);
  if (!lineInfo) {
    return undefined;
  }

  return {
    filePath: activeEditor.document.uri.fsPath,
    commitHash: lineInfo.commitHash
  };
}

function toUri(value: unknown): vscode.Uri | undefined {
  if (value instanceof vscode.Uri) {
    return value;
  }

  if (typeof value === "string") {
    return vscode.Uri.parse(value);
  }

  return undefined;
}

function getResolvedLanguage(): ReturnType<typeof resolveDisplayLanguage> {
  const config = getExtensionConfig();
  const locale = vscode.env.language || Intl.DateTimeFormat().resolvedOptions().locale;
  return resolveDisplayLanguage(config.language, locale);
}

async function registerDeleteCommandProxy(
  context: vscode.ExtensionContext,
  decoratorManager: DecoratorManager,
  commandId: "deleteLeft" | "deleteRight",
  defaultCommandId: "default:deleteLeft" | "default:deleteRight",
  direction: "left" | "right"
): Promise<void> {
  const commands = await vscode.commands.getCommands(true);
  if (!commands.includes(defaultCommandId)) {
    return;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (...args: unknown[]) => {
      decoratorManager.prepareForDelete(vscode.window.activeTextEditor, direction);
      await vscode.commands.executeCommand(defaultCommandId, ...args);
    })
  );
}
