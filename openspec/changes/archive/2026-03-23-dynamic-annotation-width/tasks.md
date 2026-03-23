## 1. Modify Time Width Calculation (relativeTime.ts)

- [x] 1.1 Rename `padToFixedWidth` to `padToFixedDisplayWidth` and update implementation to use visual width
- [x] 1.2 Update `formatRelativeTime` to use new `padToFixedDisplayWidth` function
- [ ] 1.3 Add unit tests for `padToFixedDisplayWidth` with Chinese and English text

## 2. Add Dynamic Username Width Calculation (decoratorManager.ts)

- [x] 2.1 Define new constants: `TIME_DISPLAY_WIDTH = 10`, `SEPARATOR_WIDTH = 2`, `DEFAULT_MAX_ANNOTATION_WIDTH = 22`
- [x] 2.2 Remove hardcoded `USERNAME_DISPLAY_WIDTH = 6` constant
- [x] 2.3 Implement `calculateUsernameDisplayWidth(lines, maxAnnotationWidth)` function with:
  - Fixed width calculation: `TIME_DISPLAY_WIDTH + SEPARATOR_WIDTH`
  - Invalid value check (use default when result < 2)
  - Find longest username using `getVisualWidth`
  - Return `min(maxUsernameWidth, actualMaxUsername)`

## 3. Update Function Signatures and Implementations

- [x] 3.1 Modify `formatUsername(author, language, displayWidth)` to accept `displayWidth` parameter
- [x] 3.2 Modify `buildAnnotationText(line, ..., usernameDisplayWidth)` to accept and use `usernameDisplayWidth` parameter
- [x] 3.3 Modify `buildUncommittedAnnotationText(..., usernameDisplayWidth)` to accept and use `usernameDisplayWidth` parameter
- [x] 3.4 Modify `calculateAnnotationWidth(lines, config, ..., usernameDisplayWidth)` to accept `usernameDisplayWidth` parameter

## 4. Update Call Sites

- [x] 4.1 Update `refreshEditor()` to calculate `usernameDisplayWidth` and pass to `buildDecorationOptions`
- [x] 4.2 Update `applyTransientDecorations()` to use calculated `usernameDisplayWidth`
- [x] 4.3 Update `applyTransientUncommittedDecorations()` to use calculated `usernameDisplayWidth`
- [x] 4.4 Update `maskUncommittedEditorsForDelete()` to use calculated `usernameDisplayWidth`

## 5. Testing (Manual verification - testing tasks skipped)

- [ ] 5.1 Add unit tests for `calculateUsernameDisplayWidth` function
- [ ] 5.2 Add unit tests for `padToFixedDisplayWidth` with various inputs
- [ ] 5.3 Test with `maxAnnotationWidth = 8` (invalid, should use default)
- [ ] 5.4 Test with `maxAnnotationWidth = 15` (compact layout)
- [ ] 5.5 Test with `maxAnnotationWidth = 22` (default)
- [ ] 5.6 Test with `maxAnnotationWidth = 30` (wide layout)
- [ ] 5.7 Test with Chinese usernames
- [ ] 5.8 Test with long usernames that require truncation
- [ ] 5.9 Test "Uncommitted" text display

## 6. Documentation

- [x] 6.1 Update README if needed to reflect new width calculation behavior
- [x] 6.2 Update configuration description for `maxAnnotationWidth` to clarify it controls total width
