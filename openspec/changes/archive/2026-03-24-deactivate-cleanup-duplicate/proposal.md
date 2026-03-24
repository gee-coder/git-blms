## Why

Currently, when GitBlms is disabled or uninstalled, the extension does not properly clean up its state:
1. Right-click context menu items remain visible (because context keys are not cleared)
2. Blame annotations (inline author information) remain displayed in editors
3. Gutter color indicators remain visible

This causes a confusing user experience where the extension appears to still be active even after being disabled.

## What Changes

Implement proper cleanup in the `deactivate()` function to ensure:

1. **Menu items hidden immediately**: Clear all context keys (`gitBlms.enabled`, `gitBlms.annotationEnabled`, `gitBlms.gutterEnabled`)
2. **Decorations removed immediately**: Clear all inline blame annotations from all visible editors
3. **Gutter indicators removed immediately**: Clear all gutter color indicators from all visible editors
4. **Re-activation works correctly**: When the extension is re-enabled, it should function normally without requiring a VSCode restart

## Capabilities

### Modified Capabilities
- `extension-lifecycle`: Proper deactivation cleanup that complements the existing activation logic

## Impact

- **Code affected**:
  - `src/extension.ts` - Implement `deactivate()` function
  - `src/config.ts` - Add helper functions to clear context keys
- **API changes**: None (internal cleanup only)
- **Dependencies**: None
- **User experience**: Extension cleanly removes all visual traces when disabled/uninstalled; menus disappear immediately
