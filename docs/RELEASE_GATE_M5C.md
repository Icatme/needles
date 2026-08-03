# M5C · 手动发布门禁与部署

## 原则

仓库不在 push、pull request、定时任务或部署事件上自动运行 CI/CD。所有验证和部署都由 GitHub Actions 页面中的 **Run workflow** 显式启动。

## Release gate

`Release gate` 是合并或发布前的统一手动门禁，依次执行：

1. 安装固定版本的测试依赖；
2. 运行全部 Node 回归；
3. 校验 JSON 关卡包与迁移源一致；
4. 解析全部已提交关卡包 JSON；
5. 安装 Chromium；
6. `base_url` 为空时运行全部 M5A/M5B 浏览器流程；
7. `base_url` 非空时只对部署地址运行启动冒烟；
8. 上传 Playwright HTML 报告。

## Deploy Pages

`Deploy Pages` 也是纯手动 workflow，执行：

1. Node 回归；
2. 关卡包一致性检查；
3. 本地完整 Chromium 流程；
4. 只复制运行时资源到 `_site`：
   - `index.html`
   - `css/`
   - `js/`
   - `packs/`
   - `assets/`
5. 上传并部署 GitHub Pages artifact；
6. 使用部署产生的真实 `page_url` 再运行一次启动冒烟；
7. 分别保留部署前和部署后的 Playwright 报告。

首次使用前，需要在仓库 Settings → Pages 中把发布源设置为 **GitHub Actions**。部署 job 使用 `github-pages` environment，并申请 Pages 所需的 `pages: write` 与 `id-token: write` 权限。

## 建议手动顺序

合并前：

1. 在目标 PR 分支手动运行 `Tests`；
2. 手动运行 `Export level packs`；
3. 手动运行 `Browser smoke`；
4. 最后运行 `Release gate`。

发布时：

1. 从 `main` 手动运行 `Deploy Pages`；
2. 确认 `deployed-smoke` 成功；
3. 下载并保留本次 Playwright 报告。

## 发布失败处理

- Node 或关卡包检查失败：禁止部署，先修复代码或数据；
- 本地浏览器流程失败：查看 pre-deploy report、截图、录像和 trace；
- Pages 部署失败：检查 Pages 发布源、environment 和权限；
- 部署后冒烟失败：保留现有部署，修复后重新手动执行，不用新的失败版本覆盖问题证据。
