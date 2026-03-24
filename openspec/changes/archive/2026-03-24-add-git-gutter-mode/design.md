## Context

GitBlms currently uses a single `enabled` boolean configuration to control both gutter color indicators and inline annotations. When `enabled = true`, both visual elements are displayed together. Users want independent control over these two elements.

The existing code structure:
- `DecoratorManager` handles all decoration rendering (both gutter and inline)
- `committedDecorationType` and `uncommittedDecorationType` are used for inline annotations
- Gutter decorations use dynamically created `TextEditorDecorationType` instances per color
- Menu visibility is controlled by the `gitBlms.enabled` context key

## Goals / Non-Goals

**Goals:**
- Allow independent control of gutter color indicators and inline annotations
- Provide intuitive right-click menu access (Show/Hide for each feature)
- Keep implementation simple with no new user-facing configuration options
- Maintain backward compatibility with existing behavior

**Non-Goals:**
- Persisting display states across VS Code restarts
- Adding user-facing configuration options for display modes
- Keyboard shortcuts for these controls (can be added later if requested)

## Decisions

### Independent State Representation

**Decision:** Use two independent boolean values in `DecoratorManager` to track each feature's state.

```typescript
class DecoratorManager {
  private gutterEnabled = true;      // Gutter color indicators
  private annotationEnabled = true;  // Inline annotations (blame)
}
```

**Rationale:**
- Clean separation of concerns
- Each feature can be toggled independently
- Simple and intuitive
- Memory-only state aligns with requirement to not persist
- Default `true` for both ensures backward compatibility

**Alternatives considered:**
- Enum with three/four states - adds coupling between features
- Single config option - doesn't allow independent control

### Command Design

**Decision:** Four separate commands for independent control.

```typescript
// Gutter controls
async function showGutter(): Promise<void> {
  if (!getExtensionConfig().enabled) await setEnabled(true);
  decoratorManager.setGutterEnabled(true);
}

async function hideGutter(): Promise<void> {
  decoratorManager.setGutterEnabled(false);
}

// Annotation controls
async function showBlame(): Promise<void> {
  if (!getExtensionConfig().enabled) await setEnabled(true);
  decoratorManager.setAnnotationEnabled(true);
}

async function hideBlame(): Promise<void> {
  decoratorManager.setAnnotationEnabled(false);
}
```

**Rationale:**
- Clear separation: each command affects only its target feature
- `hideBlame` no longer disables the entire extension - only hides annotations
- `hideGutter` only hides gutter, doesn't affect annotations
- Consistent with user expectation: "Show X" / "Hide X"

**Alternatives considered:**
- Toggle commands - less predictable than direct show/hide
- Combined commands - adds complexity

### Context Keys

**Decision:** Two separate VS Code context keys.

```typescript
gitBlms.gutterEnabled      // boolean
gitBlms.annotationEnabled   // boolean
```

**Rationale:**
- Simple boolean values are easy to reason about
- Menu conditions are straightforward: `!gitBlms.gutterEnabled` → Show Gutter
- Clear separation between the two features

### Menu Visibility Logic

**Decision:** Menu items shown based on feature state.

```typescript
// Show Blame: show when annotationEnabled == false
"when": "resourceScheme == file && !gitBlms.annotationEnabled"

// Hide Blame: show when annotationEnabled == true
"when": "resourceScheme == file && gitBlms.annotationEnabled"

// Show Gutter: show when gutterEnabled == false
"when": "resourceScheme == file && !gitBlms.gutterEnabled"

// Hide Gutter: show when gutterEnabled == true
"when": "resourceScheme == file && gitBlms.gutterEnabled"
```

**Rationale:**
- Each pair (Show/Hide) is mutually exclusive based on current state
- User always sees the action that will change the current state
- Clean and predictable

### Decoration Rendering

**Decision:** Check both independent flags when rendering.

```typescript
private setEditorDecorations(
  editor: vscode.TextEditor,
  options: { committed; uncommitted; gutterByColor }
): void {
  // Gutter decorations
  if (this.gutterEnabled) {
    for (const [color, decorations] of options.gutterByColor) {
      editor.setDecorations(decorationType, decorations);
    }
  } else {
    // Clear all gutter decorations
    for (const [color, decorationType] of this.gutterDecorationTypes) {
      editor.setDecorations(decorationType, []);
    }
  }

  // Inline annotations
  if (this.annotationEnabled) {
    editor.setDecorations(this.committedDecorationType, options.committed);
    editor.setDecorations(this.uncommittedDecorationType, options.uncommitted);
  } else {
    editor.setDecorations(this.committedDecorationType, []);
    editor.setDecorations(this.uncommittedDecorationType, []);
  }
}
```

**Rationale:**
- Each visual element controlled independently
- When both disabled, no decorations shown (clean state)
- When both enabled, matches original behavior

## Risks / Trade-offs

### Non-persistent state

**Risk:** Users may expect their display preferences to persist across VS Code restarts.

**Mitigation:** Default to both enabled when extension is enabled (current behavior), so users see familiar view. If frustration emerges, can add persistence in future release.

### Both features disabled

**Risk:** Users can disable both gutter and annotations, leaving no visual feedback that the extension is enabled.

**Mitigation:** The `enabled` config still controls whether blame data is fetched. Users can use the main toggle to fully disable. The independent controls are for fine-grained display control.

### Changed hideBlame behavior

**Risk:** `hideBlame` no longer disables the entire extension, only hides annotations.

**Mitigation:** This is actually more intuitive - users who want to hide annotations can still see gutter colors. To fully disable, users can disable both features or use the config setting.

## Migration Plan

No migration needed - this is a pure addition with behavior changes that are more intuitive.

### Deployment Steps
1. Merge code changes
2. Release new version
3. Users access via right-click menu immediately

### Rollback Strategy
Revert to previous version - existing config and behavior restored.

## Open Questions

None - design is straightforward with clear constraints.
