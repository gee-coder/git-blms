## Context

The `DecoratorManager` class has two independent display toggles:
- `gutterEnabled`: Controls gutter color indicators
- `annotationEnabled`: Controls inline blame annotations

When users disable both features, the `setEditorDecorations()` method correctly clears all decorations. However, the transient decoration flow (triggered during file editing) does not check these flags before applying decorations.

**Current Flow (simplified):**
```
onDidChangeTextDocument
  → scheduleRefresh()
    → applyTransientDecorations() or applyTransientUncommittedDecorations()
      → setEditorDecorations() → clears decorations if both disabled
```

The issue: decorations are computed and applied by the transient methods before `setEditorDecorations()` checks the flags and clears them. This creates a visible flash.

## Goals / Non-Goals

**Goals:**
- Prevent transient decorations from being applied when both display features are disabled
- Maintain existing behavior for all enabled/disabled combinations
- Avoid unnecessary computation when features are disabled

**Non-Goals:**
- No changes to the decoration rendering logic itself
- No changes to configuration or API surface

## Decisions

### Guard Condition Placement

**Decision:** Add the guard condition in `scheduleRefresh()` before calling transient decoration methods.

**Rationale:**
- `scheduleRefresh()` is the entry point for all transient decoration logic
- Early exit avoids unnecessary computation (building transient blame lines, calculating decoration options)
- Single point of control - clear and maintainable

**Alternatives Considered:**
1. **Add guards inside `applyTransientDecorations()` and `applyTransientUncommittedDecorations()`**
   - Rejected: Would duplicate the same check in two methods
   - Computation would still happen (method parameters evaluated before call)

2. **Check flags in `setEditorDecorations()` and skip clearing**
   - Rejected: The core issue is that decorations are applied, then cleared. The flash happens between apply and clear.

### Guard Logic

**Decision:** Skip transient decorations only when BOTH `gutterEnabled` AND `annotationEnabled` are `false`.

**Rationale:**
- If either feature is enabled, transient decorations should be applied
- The existing logic in `setEditorDecorations()` already handles selective display
- This matches the user's mental model: "hide both" means "show nothing"

## Risks / Trade-offs

**Risk:** Edge case where transient decorations are needed for internal state even when not displayed.

**Mitigation:** The transient decorations are only used for display purposes. The persistent `renderedBlameLines` and `renderedLineInfo` maps are maintained separately and updated after the scheduled refresh completes, so internal state remains consistent.

**Trade-off:** Small increase in branching complexity for significant UX improvement.

## Open Questions

None - this is a straightforward bug fix with clear implementation path.
