## ADDED Requirements

### Requirement: Fixed-width date format
系统 MUST 使用固定宽度的日期格式显示提交时间，确保标注栏对齐稳定。

#### Scenario: Absolute date format
- **WHEN** 用户配置 dateFormat 为 "absolute"
- **THEN** 系统显示格式为 `yyyy/mm/dd`（4位年份、2位月份、2位日期，用斜杠分隔）
- **AND** 总宽度固定为10个字符
- **AND** 例如：`2025/03/23`

#### Scenario: Relative date format - recent
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间在1小时内
- **THEN** 系统显示短格式相对时间
- **AND** 总宽度固定为10个字符，不足部分补空格
- **AND** 例如：`just now  `（8字符+2空格）

#### Scenario: Relative date format - hours
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间为数小时前
- **THEN** 系统显示格式为 `{N}h ago`
- **AND** 总宽度固定为10个字符，不足部分补空格
- **AND** 例如：`5h ago    `（7字符+3空格）

#### Scenario: Relative date format - days
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间为数天前
- **THEN** 系统显示格式为 `{N}d ago`
- **AND** 总宽度固定为10个字符，不足部分补空格
- **AND** 例如：`3d ago    `（7字符+3空格）

#### Scenario: Relative date format - weeks
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间为数周前
- **THEN** 系统显示格式为 `{N}w ago`
- **AND** 总宽度固定为10个字符，不足部分补空格
- **AND** 例如：`2w ago    `（7字符+3空格）

#### Scenario: Relative date format - Chinese locale
- **WHEN** 用户语言为中文且提交时间为数分钟前
- **THEN** 系统显示中文相对时间
- **AND** 总宽度固定为10个字符（按中文显示宽度计算）
- **AND** 例如：`5分钟前    `（4字符+6空格）

### Requirement: Fixed-width username display
系统 MUST 限制用户名显示宽度并统一处理短名称，确保标注栏对齐。

#### Scenario: Long Chinese username
- **WHEN** 用户名超过6个显示宽度（3个中文字符）
- **THEN** 系统截断为最多3个中文字符
- **AND** 在截断处添加单字符省略号 `…`
- **AND** 剩余部分用空格填充至6显示宽度
- **AND** 例如：`张三李四王五` → `张三…   `（3汉字+1省略号+2空格显示宽度）

#### Scenario: Short Chinese username
- **WHEN** 用户名少于6个显示宽度
- **THEN** 系统在名称后添加空格填充至6显示宽度
- **AND** 例如：`李四` → `李四     `（2汉字+4空格显示宽度）

#### Scenario: Long English username
- **WHEN** 英文用户名超过6个字符
- **THEN** 系统截断为5个字符
- **AND** 在截断处添加单字符省略号 `…`
- **AND** 剩余部分用空格填充至6字符
- **AND** 例如：`JohnDoeSmith` → `JohnD… `（5字符+1省略号）

#### Scenario: Short English username
- **WHEN** 英文用户名少于或等于6个字符
- **THEN** 系统在名称后添加空格填充至6字符
- **AND** 例如：`Alice` → `Alice `（5字符+1空格）

### Requirement: Annotation separator
系统 MUST 在日期和用户名之间使用固定分隔符。

#### Scenario: Separator format
- **WHEN** 系统生成行内标注文本
- **THEN** 日期和用户名之间使用2个空格分隔
- **AND** 例如：`2025/03/23  张三   `
