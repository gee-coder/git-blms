## Why

When GitBlms is disabled or uninstalled, the extension does not properly clean up its state. Right-click context menu items remain visible, blame annotations (inline author information) remain displayed, and gutter color indicators remain visible. This creates a confusing user experience where the extension appears active even after being disabled.

## What Changes

- Implement proper cleanup in the `deactivate()` function
- Clear all context keys (`gitBlms.enabled`, `gitBlms.annotationEnabled`, `gitBlms.gutterEnabled`) on deactivation
- Immediately remove all inline blame annotations from all visible editors on deactivation
- Immediately remove all gutter color indicators from all visible editors on deactivation
- Ensure extension works correctly when re-enabled without requiring VSCode restart

## Capabilities

### Modified Capabilities
- `extension-lifecycle`: Add proper deactivation cleanup to complement existing activation logic

## Impact

- **Code affected**:
  - `src/extension.ts` - Implement `deactivate()` function
  - `src/config.ts` - Add helper functions to clear context keys
- **API changes**: None (internal cleanup only)
- **Dependencies**: None
- **User experience**: Extension cleanly removes all visual traces when disabled/uninstalled; menus disappear immediately
