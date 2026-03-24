## 1. Type Definitions and State

- [x] 1.1 Add two independent boolean states to `DecoratorManager` (`gutterEnabled`, `annotationEnabled`)
- [x] 1.2 Add `setGutterEnabled(enabled: boolean): void` method to `DecoratorManager`
- [x] 1.3 Add `setAnnotationEnabled(enabled: boolean): void` method to `DecoratorManager`
- [x] 1.4 Add `isGutterEnabled(): boolean` and `isAnnotationEnabled(): boolean` getter methods

## 2. Decoration Rendering Logic

- [x] 2.1 Modify `setEditorDecorations()` to check `gutterEnabled` before setting gutter decorations
- [x] 2.2 Modify `setEditorDecorations()` to check `annotationEnabled` before setting inline decorations
- [x] 2.3 Ensure both features can be enabled/disabled independently

## 3. Command Registration

- [x] 3.1 Add `COMMAND_SHOW_GUTTER = "git-blms.showGutter"` constant to `src/config.ts`
- [x] 3.2 Add `COMMAND_HIDE_GUTTER = "git-blms.hideGutter"` constant to `src/config.ts`
- [x] 3.3 Register `git-blms.showGutter` command in `src/extension.ts`
- [x] 3.4 Register `git-blms.hideGutter` command in `src/extension.ts`

## 4. Command Implementation

- [x] 4.1 Implement `showGutter()` handler that enables gutter (doesn't affect annotations)
- [x] 4.2 Implement `hideGutter()` handler that disables gutter (doesn't affect annotations)
- [x] 4.3 Modify `showBlame()` to only enable annotations (doesn't affect gutter)
- [x] 4.4 Modify `hideBlame()` to only disable annotations (doesn't affect gutter)

## 5. Context Key Management

- [x] 5.1 Add `CONTEXT_GUTTER_ENABLED = "gitBlms.gutterEnabled"` constant to `src/config.ts`
- [x] 5.2 Add `CONTEXT_ANNOTATION_ENABLED = "gitBlms.annotationEnabled"` constant to `src/config.ts`
- [x] 5.3 Create `updateGutterEnabledContext(enabled: boolean): Promise<void>` function
- [x] 5.4 Create `updateAnnotationEnabledContext(enabled: boolean): Promise<void>` function
- [x] 5.5 Call context update functions when states change in command handlers
- [x] 5.6 Set initial context values in `initialize()` function

## 6. Package.json Configuration

- [x] 6.1 Add `git-blms.showGutter` command to `contributes.commands`
- [x] 6.2 Add `git-blms.hideGutter` command to `contributes.commands`
- [x] 6.3 Add activation events for new commands
- [x] 6.4 Update menu entries to use `gitBlms.gutterEnabled` context key
- [x] 6.5 Update menu entries to use `gitBlms.annotationEnabled` context key
- [x] 6.6 Add "Show Git Gutter" / "Hide Git Gutter" titles to localization files
- [x] 6.7 Add "显示 Git 颜色" / "隐藏 Git 颜色" titles to Chinese localization

## 7. Testing

- [ ] 7.1 Test Show Gutter from off state (should enable gutter only)
- [ ] 7.2 Test Hide Gutter (should disable gutter only)
- [ ] 7.3 Test Show Blame from off state (should enable annotations only)
- [ ] 7.4 Test Hide Blame (should disable annotations only)
- [ ] 7.5 Test independent control: enable both, disable one, verify other stays
- [ ] 7.6 Test independent control: disable both, enable one, verify other stays disabled
- [ ] 7.7 Verify right-click menu shows correct options for each state combination
- [ ] 7.8 Test extension restart (both should default to enabled when extension enabled)
- [ ] 7.9 Verify gutter decorations appear when `gutterEnabled = true`
- [ ] 7.10 Verify gutter decorations don't appear when `gutterEnabled = false`
- [ ] 7.11 Verify inline annotations appear when `annotationEnabled = true`
- [ ] 7.12 Verify inline annotations don't appear when `annotationEnabled = false`
