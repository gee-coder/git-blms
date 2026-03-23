# GitBlms

[English](./README.md) | [简体中文](./README.zh-CN.md)

GitBlms 是一个面向 VS Code 的 Git 追溯注解扩展，目标体验参考 GoLand 的 annotate / blame 视图。

## 主页

- 仓库主页: [https://github.com/gee-coder/git-blms.git](https://github.com/gee-coder/git-blms.git)
- 问题反馈: [https://github.com/gee-coder/git-blms/issues](https://github.com/gee-coder/git-blms/issues)

## 1.0.0 版本亮点

- 参考 GoLand 的左侧 blame 信息栏，布局稳定不顶代码
- 按代码年龄分层的颜色色阶，便于快速识别新旧代码
- 悬浮查看作者、提交时间、哈希和提交摘要
- 支持未保存文件，优先基于当前编辑器内容执行 `git blame --contents -`
- 未提交代码有单独的可配置样式
- 支持为当前 Git 用户提交的代码设置单独色调，并保留时间色阶层次
- 内置中英文运行时文案，并提供自定义插件图标

## 效果预览

![GitBlms 效果图](./images/preview.png)

## 功能概览

- 稳定的左侧 blame 信息栏，按行显示日期和作者
- 采用时间桶色阶，而不是简单透明度叠加，视觉层次更清晰
- 悬浮信息只附着在 blame 区域，尽量避免遮挡代码编辑区
- 提供大文件保护和 blame 缓存，降低性能开销
- 支持配置 blame 栏最大宽度，避免无意义留白

## 安装

1. 通过打包好的 `.vsix` 文件或 release 附件安装扩展。
2. 用 VS Code 打开一个受 Git 管理的项目。
3. 在命令面板执行 `Git: Toggle Inline Git Blame`。

默认快捷键:

- Windows / Linux: `Ctrl+Alt+B`
- macOS: `Cmd+Alt+B`

## 命令

- `Git: Toggle Inline Git Blame`
- `Git: Show Inline Git Blame`
- `Git: Hide Inline Git Blame`
- `Git: Open Commit Details`

## 配置项

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `git-blms.enabled` | `false` | 全局启用或关闭行内追溯注解 |
| `git-blms.colorScheme` | `"blue"` | 注解主色调，可选 `blue`、`green`、`purple` |
| `git-blms.dateFormat` | `"absolute"` | 时间显示格式，可选 `relative` 或 `absolute` |
| `git-blms.maxLineCount` | `5000` | 大文件保护阈值 |
| `git-blms.cacheTimeout` | `60000` | blame 缓存时长，单位毫秒 |
| `git-blms.maxAnnotationWidth` | `22` | 注释区域总宽度（时间 + 分隔符 + 用户名）。时间占 10 个显示宽度，分隔符占 2 个，用户名动态占用剩余空间。 |
| `git-blms.uncommittedColor` | `"46,160,67"` | 未提交行颜色，支持 CSV、`rgb(...)` 和十六进制 |
| `git-blms.currentAuthorColor` | `""` | 当前 Git 用户提交代码的高亮色。留空表示关闭，同时保留代码年龄色阶 |
| `git-blms.language` | `"auto"` | 插件显示语言，可选 `auto`、`zh-CN`、`en` |

## 体验说明

VS Code 的装饰器能力可以在代码前渲染稳定信息栏并提供悬浮信息，但不能完全复刻 GoLand gutter 中的可点击文本。Easy Git 采用的是目前最接近的实现：

- 在代码左侧渲染固定 blame 栏
- 使用更有对比度的时间桶色阶
- 通过悬浮链接和命令面板承接提交详情操作

## 开发

```bash
npm install
npm run compile
npm test
```

按 `F5` 启动扩展开发宿主。

## Open VSX 发布

仓库里已经带了一个用于发布 Open VSX 的 PowerShell 脚本：

```bash
npm run package:vsix
npm run publish:openvsx
```

如果还需要先创建 publisher namespace，可以执行：

```bash
npm run publish:openvsx:namespace
```

脚本会优先从 `OPENVSX_TOKEN` 或 `OVSX_PAT` 读取 token，也支持手动给 `./scripts/publish-openvsx.ps1` 传 `-Token`。

## GitHub Actions

仓库里已经带了自动发布 Open VSX 的工作流：`.github/workflows/publish-openvsx.yml`。

- 触发方式：推送形如 `v1.0.1` 的 tag
- 手动触发：GitHub Actions 的 `workflow_dispatch`
- 必要 secret：`OPENVSX_TOKEN`

只要在仓库的 GitHub Secrets 里配置好 `OPENVSX_TOKEN`，以后推送新版本 tag 就会自动执行 lint、test、打包并发布到 Open VSX。
