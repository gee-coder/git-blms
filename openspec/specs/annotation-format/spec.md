## ADDED Requirements

### Requirement: Fixed-width date format
系统 MUST 使用固定显示宽度（10个英文字符宽度）的日期格式显示提交时间，确保标注栏对齐稳定。东亚全角字符（如中文）按2个显示宽度计算，ASCII字符按1个显示宽度计算。

#### Scenario: Absolute date format
- **WHEN** 用户配置 dateFormat 为 "absolute"
- **THEN** 系统显示格式为 `yyyy/mm/dd`（4位年份、2位月份、2位日期，用斜杠分隔）
- **AND** 显示宽度 SHALL 为 10（10个ASCII字符）
- **AND** 无需补空格
- **AND** 例如：`2025/03/23`

#### Scenario: Relative date format - recent (English)
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间在1小时内
- **THEN** 系统显示短格式相对时间
- **AND** 显示宽度 SHALL 恰好为 10（不足部分用空格填充）
- **AND** 例如：`just now  `（7字符 + 3空格 = 10显示宽度）

#### Scenario: Relative date format - hours (English)
- **WHEN** 用户配置 dateFormat 为 "relative" 且提交时间为数小时前
- **THEN** 系统显示格式为 `{N}h ago`
- **AND** 显示宽度 SHALL 恰好为 10
- **AND** 例如：`5h ago    `（7字符 + 3空格 = 10显示宽度）

#### Scenario: Relative date format - Chinese locale
- **WHEN** 用户语言为中文且提交时间为数分钟前
- **THEN** 系统显示中文相对时间
- **AND** 显示宽度 SHALL 恰好为 10（东亚全角字符按2计算，ASCII按1计算）
- **AND** 不足部分用空格填充
- **AND** 例如：`刚刚      `（2汉字×2=4显示宽度 + 6空格 = 10显示宽度）

#### Scenario: Relative date format - Chinese hours
- **WHEN** 用户语言为中文且提交时间为数小时前
- **THEN** 系统显示格式为 `{N}小时前`
- **AND** 显示宽度 SHALL 恰好为 10
- **AND** 例如：`5小时前   `（4字符：1数字+3汉字=1+3×2=7显示宽度 + 3空格 = 10显示宽度）

### Requirement: Dynamic-width username display
系统 MUST 根据配置和实际内容动态计算用户名显示宽度，优先适配实际内容，同时遵守最大宽度限制。

#### Scenario: Username fits within available space
- **WHEN** `maxAnnotationWidth` 为 22 且最长用户名为 "Alice"（5显示宽度）
- **THEN** 用户名显示宽度 SHALL 为 5（使用实际最长宽度）
- **AND** 总注释宽度 SHALL 为 17（10时间 + 2分隔符 + 5用户名）

#### Scenario: Username exceeds available space
- **WHEN** `maxAnnotationWidth` 为 15 且最长用户名为 "developer-123"（13显示宽度）
- **THEN** 用户名显示宽度 SHALL 为 3（maxAnnotationWidth - 12）
- **AND** 长用户名 SHALL 被截断为 3 显示宽度，末尾显示 `…`

#### Scenario: Invalid configuration
- **WHEN** `maxAnnotationWidth` 为 8（最小允许值）
- **THEN** 计算得到用户名宽度 = 8 - 12 = -4（非法值）
- **AND** 系统 SHALL 使用默认用户名宽度 10

#### Scenario: Long Chinese username truncation
- **WHEN** 用户名可用宽度为 6 且用户名为 "张三李四王五"（10显示宽度）
- **THEN** 系统 SHALL 截断为 2 个中文字符 + 省略号
- **AND** 显示为 `张三…`（2×2 + 1 = 5，补1空格 = 6显示宽度）

#### Scenario: Short username padding
- **WHEN** 用户名可用宽度为 10 且用户名为 "李四"（4显示宽度）
- **THEN** 系统 SHALL 用空格填充至 10 显示宽度
- **AND** 显示为 `李四      `（2汉字×2=4 + 6空格 = 10显示宽度）

### Requirement: Annotation separator
系统 MUST 在日期和用户名之间使用固定的 2 个 ASCII 空格作为分隔符。

#### Scenario: Separator format
- **WHEN** 系统生成行内标注文本
- **THEN** 日期和用户名之间 SHALL 使用 2 个 ASCII 空格分隔
- **AND** 例如：`2025/03/23  张三`（日期 + 2空格 + 用户名）
