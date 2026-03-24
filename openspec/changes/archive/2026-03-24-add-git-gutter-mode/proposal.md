## Why

Currently, GitBlms displays both gutter color indicators and inline annotations (date + username) simultaneously when enabled. Some users prefer to control these two visual elements independently - for example, showing only the color coding in the gutter without the textual annotations, or vice versa.

## What Changes

- Two independent display controls:
  - **Gutter color indicators**: Can be toggled on/off independently
  - **Inline annotations (Blame)**: Can be toggled on/off independently
- Four new commands:
  - `git-blms.showGutter` - Enable gutter color indicators
  - `git-blms.hideGutter` - Disable gutter color indicators
  - `git-blms.showBlame` - Enable inline annotations (modified to not affect gutter)
  - `git-blms.hideBlame` - Disable inline annotations (modified to not affect gutter)
- Menu visibility follows current state:
  - Show/Hide Blame shown based on `annotationEnabled` state
  - Show/Hide Gutter shown based on `gutterEnabled` state

## Capabilities

### New Capabilities
- `independent-display-controls`: Control gutter and inline annotation visibility independently

### Modified Capabilities
- `blame-toggle`: Modified `showBlame`/`hideBlame` to only control inline annotations, not gutter

## Impact

- **Code affected**:
  - `src/extension.ts` - new commands, modified existing command handlers
  - `src/decoratorManager.ts` - two independent boolean states instead of enum
  - `src/config.ts` - two separate context keys instead of single display mode
  - `package.json` - new commands and updated menu conditions
- **API changes**: None (internal state only)
- **Dependencies**: None
- **User experience**: Users can now independently control gutter colors and inline annotations; states are not persisted across VS Code restarts
