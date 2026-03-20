import * as vscode from "vscode";
import type { GitBlmsConfig } from "./types";

export const EXTENSION_SECTION = "git-blms";
export const CONTEXT_ENABLED = "gitBlms.enabled";

export const COMMAND_TOGGLE_BLAME = "git-blms.toggleBlame";
export const COMMAND_SHOW_BLAME = "git-blms.showBlame";
export const COMMAND_HIDE_BLAME = "git-blms.hideBlame";
export const COMMAND_OPEN_COMMIT_DETAILS = "git-blms.openCommitDetails";

export function getExtensionConfig(): GitBlmsConfig {
  const configuration = vscode.workspace.getConfiguration(EXTENSION_SECTION);

  return {
    enabled: configuration.get<boolean>("enabled", false),
    colorScheme: configuration.get<GitBlmsConfig["colorScheme"]>("colorScheme", "blue"),
    dateFormat: configuration.get<GitBlmsConfig["dateFormat"]>("dateFormat", "absolute"),
    maxLineCount: configuration.get<number>("maxLineCount", 5000),
    cacheTimeout: configuration.get<number>("cacheTimeout", 60_000),
    maxAnnotationWidth: configuration.get<number>("maxAnnotationWidth", 22),
    uncommittedColor: configuration.get<string>("uncommittedColor", "46,160,67"),
    currentAuthorColor: configuration.get<string>("currentAuthorColor", ""),
    language: configuration.get<GitBlmsConfig["language"]>("language", "auto")
  };
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration(EXTENSION_SECTION)
    .update("enabled", enabled, vscode.ConfigurationTarget.Global);
}

export function affectsGitBlmsConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(EXTENSION_SECTION);
}

export async function updateEnabledContext(enabled: boolean): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_ENABLED, enabled);
}
