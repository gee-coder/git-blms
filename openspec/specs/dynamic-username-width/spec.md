## Purpose

定义动态用户名显示宽度的计算逻辑，使系统能够根据 `maxAnnotationWidth` 配置和实际用户名长度自适应调整用户名显示空间。

## Requirements

### Requirement: Calculate username display width dynamically
The system SHALL calculate the username display width based on the `maxAnnotationWidth` configuration and the actual username lengths in the blame results.

#### Scenario: Usernames fit within available space
- **WHEN** `maxAnnotationWidth` is 22 and the longest username is "Alice" (5 display width)
- **THEN** the username display width SHALL be 5 (actual longest)
- **AND** the total annotation width SHALL be 17 (10 time + 2 separator + 5 username)

#### Scenario: Usernames exceed available space
- **WHEN** `maxAnnotationWidth` is 15 and the longest username is "developer-123" (13 display width)
- **THEN** the username display width SHALL be 3 (maxAnnotationWidth - 12)
- **AND** long usernames SHALL be truncated with ellipsis (…)

### Requirement: Use visual width for username calculation
The system SHALL calculate username width using display width (East Asian Fullwidth = 2, ASCII = 1), not character count.

#### Scenario: Chinese username
- **WHEN** the username is "张三" (2 Chinese characters = 4 display width)
- **THEN** the display width SHALL be calculated as 4

#### Scenario: Mixed username
- **WHEN** the username is "Dev张" (3 ASCII + 1 Chinese = 5 display width)
- **THEN** the display width SHALL be calculated as 5

### Requirement: Default value protection for invalid width
The system SHALL use a default value when the calculated username width is invalid (less than 2).

#### Scenario: Invalid maxAnnotationWidth
- **WHEN** `maxAnnotationWidth` is 8 (minimum allowed value)
- **THEN** calculated username width would be -4 (8 - 12)
- **AND** the system SHALL use the default username width of 10 (22 - 12)
- **AND** the annotation SHALL display with the default width

#### Scenario: Borderline valid width
- **WHEN** `maxAnnotationWidth` is 14
- **THEN** calculated username width is 2 (14 - 12)
- **AND** the system SHALL use the calculated value of 2 (valid, not less than 2)

### Requirement: Truncate long usernames with ellipsis
The system SHALL truncate usernames that exceed the display width, replacing the last character with a single ellipsis (…).

#### Scenario: Username exceeds available width
- **WHEN** username display width is 3 and the username is "developer-123" (13 display width)
- **THEN** the displayed text SHALL be "dev…" (2 chars + ellipsis = 3 display width)
- **AND** the original username SHALL be visible on hover

### Requirement: Uncommitted text uses calculated username width
The system SHALL display "Uncommitted" (localized) using the same username width calculated for the file.

#### Scenario: Uncommitted lines display
- **WHEN** a file has uncommitted changes and the calculated username width is 8
- **THEN** "Uncommitted" text SHALL be formatted to 8 display width
- **AND** the width SHALL remain constant while the file is open (not recalculated on each edit)
