# Changelog

All notable changes to this project will be documented in this file.
本项目的重要变更会记录在这里。

## [1.0.1] - 2026-03-20

### Changed

- Improved structural edit handling for inline blame so Enter is stable and delete-path flashing is reduced
- Split committed and uncommitted decorations to lower full-editor repainting during line merges
- Added hex-based color settings with picker-friendly configuration metadata
- Added a dedicated current-author highlight toggle and refreshed related setting descriptions

## [1.0.0] - 2026-03-20

### Added

- GitBlms 1.0.0: GoLand-style inline Git blame column for VS Code
- Age-bucketed annotation colors with stronger visual contrast
- Hover commit details with author, timestamp, hash, and summary
- Unsaved file support via `git blame --contents -`
- Configurable uncommitted-line color and blame column max width
- Chinese and English runtime language support
- Custom extension icon and refreshed marketplace metadata

### 新增

- GitBlms 1.0.0：面向 VS Code 的 GoLand 风格行内 Git blame 信息栏
- 更有视觉对比度的按代码年龄分层色阶
- 作者、时间、哈希和摘要的悬浮提交详情
- 基于 `git blame --contents -` 的未保存文件支持
- 未提交代码颜色和 blame 栏最大宽度配置
- 中英文运行时语言支持
- 自定义插件图标和更新后的插件说明页元数据
