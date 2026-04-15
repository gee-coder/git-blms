## 1. Implementation

- [x] 1.1 Add guard condition in `scheduleRefresh()` method to skip transient decorations when both `gutterEnabled` and `annotationEnabled` are `false`
- [x] 1.2 Verify the guard condition is placed before the `hasStructuralLineChange` and `hasStructuralLineDeletion` checks
- [x] 1.3 Ensure the guard uses short-circuit evaluation: `if (this.gutterEnabled || this.annotationEnabled) { ... }`

## 2. Testing

- [ ] 2.1 Manually test: Disable both blame and gutter, then edit a file - verify no decorations flash
- [ ] 2.2 Manually test: Enable only gutter, edit a file - verify only gutter decorations appear during editing
- [ ] 2.3 Manually test: Enable only annotations, edit a file - verify only inline decorations appear during editing
- [ ] 2.4 Manually test: Enable both, edit a file - verify both decorations appear as before

## 3. Verification

- [ ] 3.1 Run existing test suite to ensure no regressions
- [ ] 3.2 Check that `setEditorDecorations()` logic remains unchanged (still handles selective display correctly)
- [ ] 3.3 Verify no console errors or warnings when editing with features disabled
