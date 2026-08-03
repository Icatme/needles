# M5B · 关键浏览器流程

M5B 在 M5A 的 Chromium 基础上增加确定性关键流程测试。

## 测试包注入

测试不修改生产关卡，也不依赖人工把握旋转时机。Playwright 在浏览器网络层替换 `packs/index.json`，临时加入 `e2e` 测试包：

- `e2e-01`：一针、无障碍，稳定完成；
- `e2e-02`：命中方向附近放置障碍，稳定碰撞；
- 生产 `balanced-v2` 和 `legacy` 仍同时加载，用于验证关卡包切换。

测试包只存在于 `e2e/flows.spec.js` 的响应数据中，不会进入游戏发布资源。

## 覆盖流程

### 皮肤与关卡包

- 从机械天文台切换到鎏光宝匣；
- 刷新页面后皮肤选择保持；
- 使用 `L` 进入关卡实验室；
- 使用键盘在 `e2e`、`balanced-v2` 与 `legacy` 之间切换；
- 当前关卡包选择写入 ProgressStore。

### 测试模式

- 从关卡实验室点击测试关卡；
- 路由明确为 `mode: test`；
- 完成 `e2e-01` 后正常进入下一测试关；
- 测试完成不写入正常进度；
- `e2e-02` 发生碰撞；
- 结果页重新挑战保持同一 pack、level 和 test mode。

### 正常进度

- 主菜单 Enter 启动 `e2e-01` progression；
- 完成后按稳定 ID 记录 `e2e-01`；
- 下一解锁位置变为 `e2e-02`；
- 刷新后继续入口恢复到 `e2e-02`；
- 失败重试保持 progression 路由。

所有流程继续收集 console error、page error 和失败网络请求。

## 运行方式

在 GitHub Actions 页面手动执行 `Browser smoke`。该 workflow 同时运行 M5A 启动冒烟和 M5B 关键流程。
