# ASG.Director 打包体积优化指南

## 🎯 优化目标
将打包体积从 **177.82 MB** 减少到 **100 MB 以下**

## 📊 问题分析

原打包体积分布：
- 总安装包大小: **177.82 MB**
- app.asar (应用代码): **124.7 MB**

主要问题：
1. ❌ **ASG.Director.7z** - 50.47 MB (被错误打包)
2. ❌ **assets图片** - 50.05 MB (未优化的PNG)
   - surHalf: 17.98 MB
   - hunBig: 14.38 MB  
   - surBig: 11.53 MB
   - hunHalf: 4.31 MB
3. ❌ **vuepress-docs** - 3.32 MB (开发文档)
4. ❌ **其他文档文件** - *.md, *.txt 等

## ✅ 优化措施

### 1. 排除不必要文件
修改 `package.json` 的 `build.files` 配置：
- ✅ 排除 `ASG.Director.7z`
- ✅ 排除 `vuepress-docs/`
- ✅ 排除 `docs/`
- ✅ 排除所有 `.md` 文件
- ✅ 排除所有 `.txt` 文件
- ✅ 排除压缩包文件 (`.7z`, `.zip`, `.rar`)

**预计减少**: ~54 MB

### 2. 优化图片资源
使用 `sharp` 库压缩PNG图片：
```bash
npm run optimize:images
```

优化策略：
- 使用PNG调色板模式
- 最高压缩级别 (level 9)
- 自适应过滤
- 预期压缩率: 30-50%

**预计减少**: ~20-25 MB

### 3. 清理构建产物
自动清理脚本：
```bash
npm run clean:bundle
```

## 🚀 使用方法

### 快速开始
直接构建（自动清理不必要文件）：
```bash
npm run build
```

构建流程会自动执行：
1. `prebuild` - 清理文件（ASG.Director.7z、vuepress-docs、docs等）
2. `build` - 打包应用
3. `postbuild` - 分析打包体积

> **注意**: 图片优化只需要运行一次，已完成优化且从自动构建流程中移除。

### 手动操作

如果需要单独执行某个步骤：

```bash
# 1. 清理不必要文件（每次构建自动执行）
npm run clean:bundle

# 2. 优化图片（⚠️ 只在首次或添加新图片时运行）
npm run optimize:images

# 3. 打包
npm run build

# 4. 分析体积
npm run analyze:bundle
```

### ⚠️ 重要提示

- **图片优化已完成**: assets目录的PNG图片已经压缩优化（节省了34.35MB），不需要再次运行
- **何时需要重新优化**: 仅当你添加了新的PNG图片到assets目录时才需要运行 `npm run optimize:images`
- **优化是就地替换**: 原始图片会被压缩后的版本替换，如需保留原图请先备份


## 📈 预期结果

优化前：
- 安装包: **177.82 MB**
- app.asar: **124.7 MB**

优化后（预计）：
- 安装包: **~90-100 MB** ✅
- app.asar: **~50-60 MB** ✅

**总减少**: ~75-85 MB (约**42-48%**)

## ⚠️ 注意事项

1. **图片优化是有损的**：首次运行会保留原始PNG文件的副本，确认无问题后再删除
2. **不要在源码目录保留大文件**：`.7z`等压缩包应放在项目外
3. **定期检查打包内容**：运行 `npm run analyze:bundle` 查看体积分布
4. **文档单独管理**：`vuepress-docs` 应该单独部署，不要打包进应用

## 🔧 进一步优化建议

如果还需要更小的体积：

1. **使用asar压缩** (已启用)
2. **考虑使用WebP格式**：替代PNG，体积更小
3. **按需加载插件**：将plugins从核心包分离
4. **Tree Shaking**：确保没有引入未使用的依赖
5. **检查node_modules**：
   ```bash
   npm install --production
   # 或使用 npm prune --production
   ```

## 📋 检查清单

打包前确认：
- [ ] 删除根目录的 `ASG.Director.7z`
- [ ] 运行 `npm run optimize:images`
- [ ] 运行 `npm run clean:bundle`
- [ ] 检查 `assets/` 目录，确保只有必要的图片
- [ ] 确认不需要的文档已排除

打包后验证：
- [ ] 运行 `npm run analyze:bundle` 查看体积分布
- [ ] 检查 `dist/win-unpacked/resources/app.asar` 大小
- [ ] 测试安装包功能是否正常
- [ ] 确认安装包小于 100 MB

## 📞 问题排查

### 问题：打包体积仍然很大
1. 运行 `npm run analyze:bundle` 查看哪个部分占用大
2. 检查 `dist/win-unpacked/resources/app.asar` - 应该<60MB
3. 提取asar查看内容：`npx asar extract dist/win-unpacked/resources/app.asar temp-check`
4. 找出大文件：`Get-ChildItem -Recurse -File | Sort Length -Descending | Select -First 20`

### 问题：图片优化失败
1. 确保已安装sharp：`npm install --save-dev sharp`
2. Windows可能需要安装构建工具：`npm install --global windows-build-tools`

### 问题：应用功能异常
1. 检查是否误删了必要文件
2. 查看 `.electronbuilderignore` 和 `package.json` 的 `build.files`
3. 恢复备份重新打包

---

**最后更新**: 2026-01-13
**当前版本**: 2.4.0
