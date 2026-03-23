## Why

当前 git blame 注释中的用户名显示宽度是固定的 6 个显示宽度，无法根据 `maxAnnotationWidth` 配置动态调整。当用户设置更大的 `maxAnnotationWidth` 时，无法显示更长的用户名；当设置较小时，会导致注释被截断。同时，时间部分使用字符宽度而非显示宽度计算，导致中英文混排时显示不一致。

## What Changes

- **动态计算用户名宽度**：系统 SHALL 根据 `maxAnnotationWidth` 配置和实际用户名长度动态计算用户名显示宽度
  - 如果所有用户名最长长度小于可用空间，SHALL 使用实际最长长度
  - 如果超过可用空间，SHALL 使用最大允许值（并截断）
  - 系统 SHALL 添加非法值检查：如果计算结果小于 2，使用默认值 10

- **修复时间宽度计算**：时间部分 SHALL 改为使用显示宽度（10 个英文字符宽度）
  - 中文文本 SHALL 按 2 个显示宽度计算
  - 英文文本 SHALL 按 1 个显示宽度计算
  - 不足部分 SHALL 用空格填充

- **"Uncommitted" 文本处理**：系统 SHALL 使用与文件中用户名相同的显示宽度（文件打开后固定不变）

## Capabilities

### New Capabilities

- `dynamic-username-width`: 动态计算用户名显示宽度的能力，根据配置和实际内容自适应调整

### Modified Capabilities

- `annotation-format`: 注释格式化行为变更
  - 时间部分从字符宽度改为显示宽度计算
  - 用户名从固定宽度改为动态宽度

## Impact

- **修改的代码文件**：
  - `src/relativeTime.ts`: 修改 `padToFixedWidth` 函数，使用显示宽度计算
  - `src/decoratorManager.ts`: 添加动态用户名宽度计算逻辑，修改相关函数签名

- **配置影响**：
  - `maxAnnotationWidth` 现在能正确控制注释总宽度
  - 最小值仍为 8，但过小的值会触发默认值保护

- **兼容性**：
  - 默认配置下行为保持一致（maxAnnotationWidth = 22 时，用户名宽度约 10）
  - 使用自定义 maxAnnotationWidth 的用户会看到布局变化
