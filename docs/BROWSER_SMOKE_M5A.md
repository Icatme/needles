# M5A · 浏览器冒烟测试基础

## 范围

M5A 只建立真实 Chromium 浏览器门禁，不修改玩法、关卡参数、存档格式或视觉资源。

当前冒烟验证：

- `index.html` 成功返回；
- Phaser Canvas 可见；
- `balanced-v2` 与 `legacy` 两个关卡包均成功注册；
- 两个包各包含 50 关；
- 默认包为 `balanced-v2`；
- BootScene 最终进入 `MenuScene`；
- 无浏览器 console error；
- 无未捕获 page error；
- 无失败网络请求。

## 本地执行

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

查看有界面运行：

```bash
npm run test:e2e:headed
```

测试默认通过 `scripts/serve-static.js` 在 `127.0.0.1:4173` 启动无缓存静态服务器。

## GitHub Actions

仓库中的全部 workflow 均只允许通过 GitHub Actions 页面中的 **Run workflow** 手动启动：

- `Tests`
- `Export level packs`
- `Browser smoke`

`Browser smoke` 的 `base_url` 留空时测试当前分支；传入部署地址时直接对该地址执行冒烟，并跳过本地静态服务器。

无论测试成功或失败，workflow 都上传 `playwright-report`。失败重试会保存 trace，失败场景保存截图和录像。

## 当前非目标

- 不自动在 push 或 pull request 上运行；
- 不测试 Firefox 和 WebKit；
- 不模拟完整 50 关通关；
- 不修改生产关卡以方便测试；
- 不引入远程遥测。

M5B 将在该基础上增加菜单、皮肤、关卡实验室、测试模式、普通模式进度、失败重试和刷新恢复等关键流程。
