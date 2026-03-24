## Context

Currently, the `deactivate()` function in `extension.ts` is empty. While VSCode's extension host will eventually dispose of subscriptions (including the `DecoratorManager`), this cleanup is not immediate and does not clear the context keys that control menu visibility.

The extension uses three context keys to control menu visibility:
- `gitBlms.enabled` - Controls whether extension commands are available
- `gitBlms.annotationEnabled` - Controls show/hide blame annotation menu items
- `gitBlms.gutterEnabled` - Controls show/hide gutter menu items

These context keys are set during activation but never cleared on deactivation, causing menu items to remain visible.

## Goals / Non-Goals

**Goals:**
- Immediately clear all UI elements (decorations and menus) when extension is deactivated
- Ensure clean state that allows proper re-activation without requiring VSCode restart
- Follow VSCode extension lifecycle best practices

**Non-Goals:**
- Persisting display state across deactivation/re-activation cycles (state resets on each activation)
- Handling complex crash scenarios (normal VSCode cleanup applies)

## Decisions

### 1. Use synchronous deactivate()

VSCode's `deactivate()` function can return a Promise for async cleanup, but for this change we use synchronous operations because:

- Clearing context keys via `vscode.commands.executeCommand` is fire-and-forget
- Clearing decorations from editors is a synchronous operation
- Simpler and more reliable than async cleanup

**Alternative considered**: Async cleanup with `await`. Rejected because VSCode may terminate the extension host before async operations complete.

### 2. Explicit decoration clearing via DecoratorManager

Rather than directly manipulating editors in `deactivate()`, we call methods on `DecoratorManager` because:

- The `clearAllEditors()` method already exists and handles both inline and gutter decorations
- Keeps cleanup logic encapsulated in the responsible class
- The `DecoratorManager` instance is accessible via closure

**Alternative considered**: Direct editor manipulation. Rejected because it duplicates logic and bypasses the abstraction layer.

### 3. Clear context keys to false (not undefined)

We set context keys to `false` rather than leaving them unset because:

- VSCode's `setContext` with `false` reliably hides menus with `when` clauses checking that key
- Using `undefined` or not calling `setContext` has inconsistent behavior
- Consistent with how we manage context keys elsewhere in the extension

## Risks / Trade-offs

**Risk**: If VSCode terminates before `deactivate()` completes, cleanup may not finish.

→ **Mitigation**: This is inherent to VSCode's lifecycle. In practice, `deactivate()` is called during normal disable/uninstall scenarios where there's enough time. For abnormal termination, VSCode's extension host cleanup handles resource disposal.

**Trade-off**: Decoration state is not persisted. When extension is re-enabled, it re-calculates blame information.

→ **Rationale**: This is the current behavior (blame is re-fetched on activation) and is appropriate since git blame data may have changed.

## Open Questions

None. The requirements are clear and the implementation is straightforward.
