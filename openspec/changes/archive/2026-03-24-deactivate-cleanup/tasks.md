## 1. 添加上下文键清理函数

- [x] 1.1 在 `src/config.ts` 中添加 `clearAllContextKeys()` 函数，设置所有三个上下文键为 `false`
- [x] 1.2 在 `src/config.ts` 中添加单独的 `clearEnabledContext()` 函数

## 2. 实现 deactivate() 函数

- [x] 2.1 在 `src/extension.ts` 中实现 `deactivate()` 函数
- [x] 2.2 在 `deactivate()` 中调用 `clearAllContextKeys()` 清除上下文键
- [x] 2.3 在 `deactivate()` 中调用 `decoratorManager.clearAllEditors()` 清除装饰效果
- [x] 2.4 确保 `deactivate()` 返回 `void`（同步执行）

## 3. 测试

- [ ] 3.1 在 VS Code 中禁用扩展，验证菜单项立即消失
- [ ] 3.2 验证所有编辑器中的 blame 注释被清除
- [ ] 3.3 验证所有编辑器中的 gutter 颜色指示器被清除
- [ ] 3.4 重新启用扩展，验证功能正常工作（不需要重启 VS Code）
- [ ] 3.5 卸载并重新安装扩展，验证功能正常工作
