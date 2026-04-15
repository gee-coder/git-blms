## Why

When users disable inline annotations (`hideBlame`) and gutter decorations (`hideGutter`), they expect to see no blame information whatsoever. However, when editing a file, uncommitted decorations still flash briefly on the screen before being cleared. This creates a jarring user experience and violates the user's intent to disable blame functionality.

## What Changes

- Add guard condition in `scheduleRefresh()` to skip applying transient decorations when both `gutterEnabled` and `annotationEnabled` are `false`
- No changes to public APIs or configuration options
- No breaking changes

## Capabilities

### New Capabilities

None - this is a bug fix within existing behavior.

### Modified Capabilities

None - this fix does not change any documented requirements or specs. It corrects an implementation bug where the enabled state was not being checked before applying transient decorations.

## Impact

- **Affected Code**: `decoratorManager.ts` - `scheduleRefresh()` method
- **Dependencies**: None
- **Performance**: Minor improvement - avoids unnecessary decoration computation when features are disabled
- **Testing**: Should verify that:
  1. When blame is fully disabled, editing shows no decorations
  2. When only gutter is enabled, editing only shows gutter decorations
  3. When only annotations are enabled, editing only shows inline decorations
  4. When both are enabled, editing shows both as before
