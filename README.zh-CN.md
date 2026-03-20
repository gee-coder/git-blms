# GitBlms

[English](./README.md) | [简体中文](./README.zh-CN.md)

GitBlms 是一个面向 VS Code 的 Git 追溯注解扩展，目标体验参考 GoLand 的 annotate / blame 视图。

## 主页

- 仓库主页: [https://github.com/gee-coder/easy-git.git](https://github.com/gee-coder/easy-git.git)
- 问题反馈: [https://github.com/gee-coder/easy-git/issues](https://github.com/gee-coder/easy-git/issues)

## 1.0.0 版本亮点

- 参考 GoLand 的左侧 blame 信息栏，布局稳定不顶代码
- 按代码年龄分层的颜色色阶，便于快速识别新旧代码
- 悬浮查看作者、提交时间、哈希和提交摘要
- 支持未保存文件，优先基于当前编辑器内容执行 `git blame --contents -`
- 未提交代码有单独的可配置样式
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
| `easy-git.enabled` | `false` | 全局启用或关闭行内追溯注解 |
| `easy-git.colorScheme` | `"blue"` | 注解主色调，可选 `blue`、`green`、`purple` |
| `easy-git.dateFormat` | `"absolute"` | 时间显示格式，可选 `relative` 或 `absolute` |
| `easy-git.maxLineCount` | `5000` | 大文件保护阈值 |
| `easy-git.cacheTimeout` | `60000` | blame 缓存时长，单位毫秒 |
| `easy-git.maxAnnotationWidth` | `22` | 左侧 blame 信息栏最大宽度，单位 `ch` |
| `easy-git.uncommittedColor` | `"46,160,67"` | 未提交行颜色，支持 CSV、`rgb(...)` 和十六进制 |
| `easy-git.language` | `"auto"` | 插件显示语言，可选 `auto`、`zh-CN`、`en` |

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
