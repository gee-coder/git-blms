## ADDED Requirements

### Requirement: Cache invalidation on external git operations
系统 MUST 在检测到外部 git 操作（如 commit）后使相关缓存失效。

#### Scenario: File reopened after git commit
- **WHEN** 用户在终端执行 git commit 后重新打开文件
- **THEN** 系统检测到 git HEAD 已变化
- **AND** 系统使该文件的 blame 缓存失效
- **AND** 系统重新执行 git blame 获取最新提交信息
- **AND** 显示正确的已提交状态（而非未提交）

#### Scenario: Cache key includes git HEAD reference
- **WHEN** 系统生成缓存键
- **THEN** 缓存键 MUST 包含 git 仓库的 HEAD commit hash
- **AND** 确保 git commit 后缓存键必然变化

#### Scenario: File opened for the first time
- **WHEN** 用户打开一个已打开过的文件
- **AND** 缓存键已存在但 git HEAD 已变化
- **THEN** 系统 MUST 重新执行 git blame
- **AND** 更新缓存

### Requirement: Cache validation before reuse
系统 MUST 在使用缓存前验证缓存是否仍然有效。

#### Scenario: Cache expired by timeout
- **WHEN** 缓存条目超过配置的 cacheTimeout 时间
- **THEN** 系统 MUST 重新执行 git blame
- **AND** 更新缓存

#### Scenario: Git HEAD changed since cache
- **WHEN** 缓存条目未超时但 git HEAD 已变化
- **THEN** 系统 MUST 重新执行 git blame
- **AND** 更新缓存

### Requirement: Dirty file cache handling
系统 MUST 对未保存的脏文件使用独立的缓存策略。

#### Scenario: Dirty file cache key
- **WHEN** 文件处于脏状态（isDirty = true）
- **THEN** 缓存键 MUST 使用文档版本（document.version）
- **AND** 不受 git HEAD 变化影响

#### Scenario: File saved after edit
- **WHEN** 脏文件被保存
- **THEN** 系统 MUST 使旧的脏文件缓存失效
- **AND** 使用新的缓存键重新计算
