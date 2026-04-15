# No New or Modified Specifications

This change is a bug fix that corrects implementation behavior without changing documented requirements.

## Context

The existing behavior is already specified:
- When users disable blame annotations (via `hideBlame` command), no inline decorations should be displayed
- When users disable gutter decorations (via `hideGutter` command), no gutter indicators should be displayed

This fix addresses an implementation bug where transient decorations were being applied during editing even when both features were disabled. The "flash" of decorations was a violation of existing requirements, not a new requirement.

## Conclusion

No new specs or delta specs are needed. The fix ensures the implementation matches the existing user-facing contract.
