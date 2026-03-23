## Context

当前 git blame 注释显示在 `src/decoratorManager.ts` 和 `src/relativeTime.ts` 中实现。

**当前状态**：
- 时间宽度使用 `.padEnd(10, " ")` 按字符宽度填充，导致中文文本实际显示宽度不一致
- 用户名宽度硬编码为 `USERNAME_DISPLAY_WIDTH = 6`
- `calculateAnnotationWidth` 函数遍历所有行计算最大宽度，然后用 `clamp` 限制到 `maxAnnotationWidth`

**约束**：
- VSCode decoration `before.contentText` 使用 CSS `ch` 单位（基于字符宽度）
- 需要考虑中英文字符的显示宽度差异（中文 = 2，英文 = 1）
- `maxAnnotationWidth` 最小值为 8，但小于 14 时用户名空间不足

## Goals / Non-Goals

**Goals**:
- 时间部分严格按 10 个显示宽度格式化（中文字符按 2 计算）
- 用户名宽度根据 `maxAnnotationWidth` 和实际用户名长度动态计算
- 提供默认值保护，防止非法配置导致显示异常
- 保持文件打开后宽度固定（不因编辑而重新计算）

**Non-Goals**:
- 不改变 `maxAnnotationWidth` 配置项的定义和默认值
- 不支持自定义时间宽度或分隔符宽度（保持固定）
- 不在每次编辑时重新计算宽度（只在文件加载时计算一次）

## Decisions

### Decision 1: 时间宽度使用显示宽度计算

**选择**：修改 `padToFixedWidth` 函数，改用显示宽度计算。

**理由**：
- 当前使用 `.padEnd(10, " ")` 导致 "刚刚" (2中文) + 8空格 = 12显示宽度
- 用户期望时间是严格的 10 显示宽度
- 需要统一的宽度计算方式（都用 `getVisualWidth`）

**实现**：
- 重命名 `padToFixedWidth` → `padToFixedDisplayWidth`
- 使用 `getVisualWidth` 计算当前文本宽度
- 计算需要添加的空格数：`targetWidth - currentWidth`

### Decision 2: 动态用户名宽度计算策略

**选择**：采用 "优先适配内容，不超过限制" 的策略。

**理由**：
- 如果所有用户名都很短，不需要浪费空间
- 如果有长用户名，限制在最大允许值内并截断
- 提供最佳用户体验（显示尽可能多的信息）

**计算公式**：
```typescript
const TIME_DISPLAY_WIDTH = 10;
const SEPARATOR_WIDTH = 2;
const fixedWidth = TIME_DISPLAY_WIDTH + SEPARATOR_WIDTH;
let maxUsernameWidth = maxAnnotationWidth - fixedWidth;

// 默认值保护
if (maxUsernameWidth < 2) {
  maxUsernameWidth = DEFAULT_MAX_ANNOTATION_WIDTH - fixedWidth; // 10
}

// 找最长用户名
const actualMaxUsername = lines.reduce((max, line) => {
  const width = getVisualWidth(line.author.trim());
  return Math.max(max, width);
}, 0);

// 取较小值
return Math.min(maxUsernameWidth, actualMaxUsername);
```

### Decision 3: 默认值和最小值

**选择**：
- 默认 `maxAnnotationWidth` = 22
- 最小用户名宽度保护值 = 2
- 非法值时使用默认值 10

**理由**：
- 2 是最小可用的用户名宽度（至少显示 1 个字符 + 省略号）
- 配置最小值 8 时，计算结果为 -4，需要回退到默认值
- 保持向后兼容（默认配置下行为不变）

### Decision 4: 函数签名变更

**选择**：将 `usernameDisplayWidth` 作为参数传递给相关函数。

**理由**：
- 避免全局状态
- 便于测试
- 清晰的依赖关系

**影响的函数**：
- `calculateUsernameDisplayWidth(lines, maxAnnotationWidth)` - 新增
- `buildAnnotationText(line, ..., usernameDisplayWidth)` - 修改
- `buildUncommittedAnnotationText(..., usernameDisplayWidth)` - 修改
- `formatUsername(author, language, displayWidth)` - 修改
- `calculateAnnotationWidth(lines, config, ..., usernameDisplayWidth)` - 修改

### Decision 5: "Uncommitted" 文本处理

**选择**：使用与文件中用户名相同的宽度。

**理由**：
- 用户在 proposal 中明确说明 "文件打开后宽度不变"
- 避免编辑时宽度跳动影响体验
- "Uncommitted" 与用户名占用相同的视觉空间

**实现**：
- 在 `refreshEditor` 中计算一次 `usernameDisplayWidth`
- 传递给 `buildDecorationOptions` 和相关函数
- 瞬态编辑状态（`applyTransientDecorations`）保持相同宽度

## Risks / Trade-offs

### Risk 1: 时间格式化性能影响
**风险**：`padToFixedDisplayWidth` 需要遍历字符串计算显示宽度，比 `.padEnd` 慢。

**缓解**：
- 时间文本很短（最多 10 字符），性能影响可忽略
- 只在构建 decoration 时调用，不是热路径

### Risk 2: 布局在不同字体下的表现
**风险**：`ch` 单位在不同编辑器字体下可能有微小差异。

**缓解**：
- VSCode 默认等宽字体，`ch` 单位相对稳定
- 当前的 `getVisualWidth` 已经是标准做法
- 用户可以通过 `maxAnnotationWidth` 微调

### Risk 3: 向后兼容性
**风险**：使用自定义 `maxAnnotationWidth` 的用户会看到布局变化。

**缓解**：
- 默认配置（22）下行为基本一致
- 新逻辑更符合配置的语义（maxAnnotationWidth 真正控制最大宽度）
- 用户可以调整配置达到期望效果

## Migration Plan

### 实施步骤
1. 修改 `src/relativeTime.ts` 中的 `padToFixedWidth` 函数
2. 修改 `src/decoratorManager.ts` 添加 `calculateUsernameDisplayWidth` 函数
3. 修改相关函数签名，传递 `usernameDisplayWidth` 参数
4. 更新所有调用点
5. 添加单元测试

### 回滚策略
- Git revert 即可回滚
- 无数据迁移（纯代码变更）
- 配置项不变，用户无需手动迁移

## Open Questions

无 - 需求已在 explore 阶段明确。

## 相关代码位置

- `src/relativeTime.ts`: 时间格式化逻辑
- `src/decoratorManager.ts`:
  - Line 573: `USERNAME_DISPLAY_WIDTH = 6` (需移除)
  - Line 520-530: `buildAnnotationText` 函数
  - Line 532-542: `buildUncommittedAnnotationText` 函数
  - Line 581-590: `formatUsername` 函数
  - Line 628-644: `calculateAnnotationWidth` 函数
  - Line 658-666: `getVisualWidth` 函数
  - Line 82-84: `refreshEditor` 中调用 `calculateAnnotationWidth`
