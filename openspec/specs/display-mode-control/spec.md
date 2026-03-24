## ADDED Requirements

### Requirement: 独立显示状态管理
系统 MUST 在内存中维护两个独立的布尔状态，分别控制 Gutter 颜色指示器和行内注释。

#### Scenario: 默认状态
- **WHEN** 扩展首次启用或用户重启 VS Code 后
- **THEN** 系统 SHALL 默认同时启用 Gutter 颜色指示器和行内注释
- **AND** `gutterEnabled` SHALL 为 `true`
- **AND** `annotationEnabled` SHALL 为 `true`

#### Scenario: 状态存储
- **WHEN** 显示状态发生变化
- **THEN** 系统 SHALL 在 DecoratorManager 实例的内存中存储当前状态
- **AND** 状态 SHALL 不持久化到配置文件

### Requirement: Gutter 颜色指示器独立控制
系统 MUST 允许用户独立控制 Gutter 颜色指示器的显示，不影响行内注释。

#### Scenario: 启用 Gutter 颜色指示器
- **WHEN** 用户执行 `git-blms.showGutter` 命令
- **THEN** 系统 SHALL 设置 `gutterEnabled` 为 `true`
- **AND** 系统 SHALL 在 gutter 区域显示颜色指示器
- **AND** 系统 SHALL 不改变行内注释的状态

#### Scenario: 禁用 Gutter 颜色指示器
- **WHEN** 用户执行 `git-blms.hideGutter` 命令
- **THEN** 系统 SHALL 设置 `gutterEnabled` 为 `false`
- **AND** 系统 SHALL 清除所有 gutter 区域的颜色指示器
- **AND** 系统 SHALL 不改变行内注释的状态

#### Scenario: Gutter 关闭时的渲染
- **WHEN** `gutterEnabled` 为 `false`
- **THEN** 系统 SHALL 不在 gutter 区域显示任何颜色指示器
- **AND** 系统 SHALL 清除所有已有的 gutter 装饰

### Requirement: 行内注释独立控制
系统 MUST 允许用户独立控制行内注释的显示，不影响 Gutter 颜色指示器。

#### Scenario: 启用行内注释
- **WHEN** 用户执行 `git-blms.showBlame` 命令
- **THEN** 系统 SHALL 设置 `annotationEnabled` 为 `true`
- **AND** 系统 SHALL 在代码行首显示日期和用户名注释
- **AND** 系统 SHALL 不改变 Gutter 颜色指示器的状态

#### Scenario: 禁用行内注释
- **WHEN** 用户执行 `git-blms.hideBlame` 命令
- **THEN** 系统 SHALL 设置 `annotationEnabled` 为 `false`
- **AND** 系统 SHALL 清除所有行内注释装饰
- **AND** 系统 SHALL 不改变 Gutter 颜色指示器的状态

#### Scenario: 行内注释关闭时的渲染
- **WHEN** `annotationEnabled` 为 `false`
- **THEN** 系统 SHALL 不显示任何行内注释（日期和用户名）
- **AND** 系统 SHALL 清除所有已有的行内注释装饰

### Requirement: 组合状态支持
系统 MUST 支持两种显示元素的任意组合状态。

#### Scenario: 仅 Gutter 模式
- **WHEN** `gutterEnabled` 为 `true` 且 `annotationEnabled` 为 `false`
- **THEN** 系统 SHALL 只在 gutter 区域显示颜色指示器
- **AND** 系统 SHALL 不显示行内注释

#### Scenario: 仅行内注释模式
- **WHEN** `gutterEnabled` 为 `false` 且 `annotationEnabled` 为 `true`
- **THEN** 系统 SHALL 只显示行内注释
- **AND** 系统 SHALL 不显示 gutter 颜色指示器

#### Scenario: 全部启用模式
- **WHEN** `gutterEnabled` 为 `true` 且 `annotationEnabled` 为 `true`
- **THEN** 系统 SHALL 同时显示 gutter 颜色指示器和行内注释

#### Scenario: 全部禁用模式
- **WHEN** `gutterEnabled` 为 `false` 且 `annotationEnabled` 为 `false`
- **THEN** 系统 SHALL 不显示 gutter 颜色指示器
- **AND** 系统 SHALL 不显示行内注释

### Requirement: 右键菜单动态显示
系统 MUST 根据每个功能的当前状态动态显示对应的菜单选项。

#### Scenario: Gutter 禁用时显示启用菜单
- **WHEN** `gutterEnabled` 为 `false`
- **THEN** 右键菜单 SHALL 显示 "Show Git Gutter" / "显示 Git 颜色"
- **AND** 右键菜单 SHALL 不显示 "Hide Git Gutter" / "隐藏 Git 颜色"

#### Scenario: Gutter 启用时显示禁用菜单
- **WHEN** `gutterEnabled` 为 `true`
- **THEN** 右键菜单 SHALL 显示 "Hide Git Gutter" / "隐藏 Git 颜色"
- **AND** 右键菜单 SHALL 不显示 "Show Git Gutter" / "显示 Git 颜色"

#### Scenario: 行内注释禁用时显示启用菜单
- **WHEN** `annotationEnabled` 为 `false`
- **THEN** 右键菜单 SHALL 显示 "Show Inline Git Blame" / "显示行内追溯注解"
- **AND** 右键菜单 SHALL 不显示 "Hide Inline Git Blame" / "隐藏行内追溯注解"

#### Scenario: 行内注释启用时显示禁用菜单
- **WHEN** `annotationEnabled` 为 `true`
- **THEN** 右键菜单 SHALL 显示 "Hide Inline Git Blame" / "隐藏行内追溯注解"
- **AND** 右键菜单 SHALL 不显示 "Show Inline Git Blame" / "显示行内追溯注解"

### Requirement: VS Code 上下文键同步
系统 MUST 使用两个独立的 VS Code 上下文键来控制菜单可见性。

#### Scenario: 上下文键设置
- **WHEN** Gutter 状态发生变化
- **THEN** 系统 SHALL 更新 `gitBlms.gutterEnabled` 上下文键反映当前状态

#### Scenario: 注释上下文键设置
- **WHEN** 行内注释状态发生变化
- **THEN** 系统 SHALL 更新 `gitBlms.annotationEnabled` 上下文键反映当前状态

#### Scenario: 上下文键值
- **WHEN** 查询 `gitBlms.gutterEnabled` 上下文键
- **THEN** 值 SHALL 为布尔值 `true` 或 `false`

#### Scenario: 注释上下文键值
- **WHEN** 查询 `gitBlms.annotationEnabled` 上下文键
- **THEN** 值 SHALL 为布尔值 `true` 或 `false`
