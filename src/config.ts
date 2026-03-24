import * as vscode from "vscode";
import type { GitBlmsConfig } from "./types";

export const EXTENSION_SECTION = "git-blms";
export const CONTEXT_ENABLED = "gitBlms.enabled";
export const CONTEXT_GUTTER_ENABLED = "gitBlms.gutterEnabled";
export const CONTEXT_ANNOTATION_ENABLED = "gitBlms.annotationEnabled";

export const COMMAND_TOGGLE_BLAME = "git-blms.toggleBlame";
export const COMMAND_SHOW_BLAME = "git-blms.showBlame";
export const COMMAND_HIDE_BLAME = "git-blms.hideBlame";
export const COMMAND_SHOW_GUTTER = "git-blms.showGutter";
export const COMMAND_HIDE_GUTTER = "git-blms.hideGutter";
export const COMMAND_OPEN_COMMIT_DETAILS = "git-blms.openCommitDetails";

interface ConfigurationInspectionLike<T> {
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
}

export function getExtensionConfig(): GitBlmsConfig {
  const configuration = vscode.workspace.getConfiguration(EXTENSION_SECTION);
  const currentAuthorColor = configuration.get<string>("currentAuthorColor", "#d97706");
  const configuredCurrentAuthorColor = getConfiguredValue<string>(
    configuration.inspect("currentAuthorColor") as ConfigurationInspectionLike<string> | undefined
  );
  const configuredHighlightCurrentAuthor = getConfiguredValue<boolean>(
    configuration.inspect("highlightCurrentAuthor") as ConfigurationInspectionLike<boolean> | undefined
  );

  return {
    enabled: configuration.get<boolean>("enabled", false),
    colorScheme: configuration.get<GitBlmsConfig["colorScheme"]>("colorScheme", "blue"),
    dateFormat: configuration.get<GitBlmsConfig["dateFormat"]>("dateFormat", "absolute"),
    maxLineCount: configuration.get<number>("maxLineCount", 5000),
    cacheTimeout: configuration.get<number>("cacheTimeout", 60_000),
    maxAnnotationWidth: configuration.get<number>("maxAnnotationWidth", 22),
    uncommittedColor: configuration.get<string>("uncommittedColor", "#2ea043"),
    highlightCurrentAuthor:
      configuredHighlightCurrentAuthor ?? Boolean(configuredCurrentAuthorColor && configuredCurrentAuthorColor.trim()),
    currentAuthorColor,
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

export async function updateGutterEnabledContext(enabled: boolean): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_GUTTER_ENABLED, enabled);
}

export async function updateAnnotationEnabledContext(enabled: boolean): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_ANNOTATION_ENABLED, enabled);
}

export async function clearEnabledContext(): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_ENABLED, false);
}

export async function clearGutterEnabledContext(): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_GUTTER_ENABLED, false);
}

export async function clearAnnotationEnabledContext(): Promise<void> {
  await vscode.commands.executeCommand("setContext", CONTEXT_ANNOTATION_ENABLED, false);
}

export async function clearAllContextKeys(): Promise<void> {
  await Promise.all([
    vscode.commands.executeCommand("setContext", CONTEXT_ENABLED, false),
    vscode.commands.executeCommand("setContext", CONTEXT_GUTTER_ENABLED, false),
    vscode.commands.executeCommand("setContext", CONTEXT_ANNOTATION_ENABLED, false)
  ]);
}

function getConfiguredValue<T>(inspection: ConfigurationInspectionLike<T> | undefined): T | undefined {
  return inspection?.workspaceFolderValue ?? inspection?.workspaceValue ?? inspection?.globalValue;
}

