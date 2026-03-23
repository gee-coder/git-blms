## Context

当前 git-blms 扩展使用 VSCode 的 TextEditorDecorationType 在行首显示 git blame 信息。实现涉及以下模块：

- **relativeTime.ts**：负责日期和相对时间的格式化
- **decoratorManager.ts**：负责生成标注文本、计算宽度、应用装饰
- **blameManager.ts**：负责 git blame 的缓存管理
- **extension.ts**：负责事件监听和生命周期管理

### 问题根源

**缓存失效缺陷**的根源在 `blameManager.ts:109-122`：
```typescript
// 当前缓存键仅包含 URI 和 mtime
return `${base}::saved::${stats.mtimeMs}`;
```

当用户在终端执行 `git commit` 后：
- 文件内容未变化 → mtime 不变
- 缓存键不变 → 返回旧缓存
- 旧缓存包含"未提交"状态 → 显示错误

## Goals / Non-Goals

**Goals:**
1. 修复缓存失效缺陷，确保 git commit 后正确刷新
2. 统一标注显示宽度，解决标注栏抖动问题
3. 缩短相对时间格式，节省显示空间

**Non-Goals:**
- 不改变颜色方案计算逻辑
- 不修改配置项结构（dateFormat 仍然是 "relative" | "absolute"）
- 不影响 i18n 多语言支持（但需要更新翻译字符串）

## Decisions

### Decision 1: 缓存键包含 Git HEAD

**选择**：在缓存键中加入 git 仓库的 HEAD commit hash

**原因**：
- git commit 必然改变 HEAD
- HEAD 变化 → 缓存键变化 → 自动失效
- 无需额外监听事件或定时检查

**实现方式**：
```typescript
// 新的缓存键格式
`${base}::saved::${stats.mtimeMs}::${gitHeadHash}`
```

**备选方案（未采用）**：
- 定时检查 git HEAD：增加不必要的轮询开销
- 监听文件系统事件：.git/HEAD 变化不可靠

### Decision 2: 相对时间短格式

**选择**：使用 `{N}{unit} ago` 格式（如 `5h ago`），固定10字符宽度

**原因**：
- 当前格式 `5 hours ago` (11字符) 超出10字符宽度
- 短格式更紧凑，节省空间
- 对中文友好（`5分钟前` 只有4字符）

**单位映射**：
| 时间范围 | 格式 | 示例 |
|----------|------|------|
| < 1分钟 | `just now` | 8字符 |
| < 1小时 | `{N}m ago` | `5m ago` (7字符) |
| < 1天 | `{N}h ago` | `3h ago` (7字符) |
| < 1周 | `{N}d ago` | `2d ago` (7字符) |
| ≥ 1周 | `{N}w ago` | `1w ago` (7字符) |

### Decision 3: 用户名按显示宽度截断

**选择**：限制6显示宽度，使用单字符省略号 `…`

**原因**：
- 当前14字符宽度对于中文来说过大（14显示宽度）
- 6显示宽度可容纳3个中文字符，符合常见中文名长度
- 单字符省略号 `…` 占1显示宽度，比 `...` 更紧凑

**实现逻辑**：
```typescript
// 伪代码
function formatUsername(name: string): string {
  const displayWidth = getDisplayWidth(name); // 中文=2, 英文=1
  if (displayWidth <= 6) {
    return padRight(name, 6); // 补空格
  }
  // 截断到5显示宽度，添加省略号
  return truncateToWidth(name, 5) + '…' + ' ';
}
```

### Decision 4: 日期格式使用补零

**选择**：绝对日期格式为 `yyyy/mm/dd`，月日补零

**原因**：
- 固定10字符宽度 (`2025/03/23`)
- 保持视觉对齐
- 符合常见日期格式习惯

## Risks / Trade-offs

### Risk 1: 获取 Git HEAD 的性能开销

**风险**：每次缓存键计算都需要获取 git HEAD，可能影响性能

**缓解措施**：
- Git HEAD 获取结果应该被缓存（短时间缓存，如1秒）
- 只有在文件已保存（非脏状态）时才需要获取 HEAD

### Risk 2: 中文空格填充可能不一致

**风险**：中文字符占2显示宽度，但空格占1宽度，可能导致视觉不对齐

**缓解措施**：
- 使用等宽字体渲染标注
- 测试各种中英文混合场景

### Risk 3: 现有用户习惯改变

**风险**：格式变化可能影响用户的使用习惯

**缓解措施**：
- 这是 bug 修复 + 改进，属于合理变化
- 可以在配置中添加选项保留旧行为（如果用户强烈要求）

## Migration Plan

1. **实现缓存修复**（高优先级）
   - 修改 `blameManager.ts` 的缓存键生成逻辑
   - 添加获取 Git HEAD 的辅助函数

2. **实现格式化改进**
   - 修改 `relativeTime.ts` 的日期/时间格式化
   - 修改 `decoratorManager.ts` 的用户名截断逻辑

3. **更新翻译**
   - 添加/更新相对时间短格式的翻译字符串

4. **测试**
   - 验证 git commit 后缓存正确失效
   - 验证各种用户名长度的显示效果
   - 验证中英文环境下的格式化

## Open Questions

1. **是否需要配置选项**：是否允许用户自定义显示宽度？
   - 建议：先不添加，观察用户反馈

2. **超长相对时间**：超过1年的提交如何显示？
   - 建议：使用 `{N}y ago` 格式，如 `2y ago`

3. **Git HEAD 获取失败**：如果无法获取 Git HEAD 怎么办？
   - 建议：降级为不包含 HEAD 的缓存键，但记录警告
