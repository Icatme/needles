# M7C · 关卡包开发预览

## 目标

作者修改 JSON 后，不需要改场景或写临时代码；刷新带参数的本地 URL 即可直达指定包、关卡、章节和皮肤。

预览只接受已经注册到 `packs/index.json` 的同源关卡包。不会加载 manifest URL、跨域资源、脚本路径或包内可执行代码。

## 启动命令

直达具体关卡：

```bash
npm run preview:pack -- \
  --pack balanced-v2 \
  --level 10 \
  --mode test \
  --skin gilded-jewel-box
```

CLI 会先执行正式 Schema、PackValidator 和 LevelResolver 校验，并把数字 order 规范化为 stable level ID。

只打印 URL，不启动服务器：

```bash
npm run preview:pack -- \
  --pack balanced-v2 \
  --level balanced-v2-10 \
  --print-only
```

直达关卡实验室：

```bash
npm run preview:pack -- \
  --pack balanced-v2 \
  --lab \
  --chapter chapter-3 \
  --page 1
```

## URL 参数

浏览器只识别：

| 参数 | 含义 |
|---|---|
| `pack` | 已注册 pack ID |
| `level` | stable level ID 或数字 order |
| `mode` | `test` 或 `progression` |
| `skin` | 已注册 skin ID |
| `lab` | `1/true/yes` 时进入实验室 |
| `chapter` | manifest chapter ID |
| `page` | 实验室页码 |

例如：

```text
http://127.0.0.1:4173/?pack=balanced-v2&level=balanced-v2-10&mode=test&skin=gilded-jewel-box
```

未知参数如 `manifest`、`url`、`script` 会被忽略，不能改变加载源。

## 启动顺序

1. PreviewOptions 只解析查询参数；
2. BootScene 正常加载并校验 `packs/index.json`；
3. 所有关卡包注册完成后，PreviewOptions 通过 AppContext/Catalog/Router 解析目标；
4. 目标合法时进入菜单、实验室或 GameScene；
5. 目标非法时停留在 BootScene 的错误界面，不静默回退到其他关卡。

无查询参数时，启动路径与 M7C 前完全相同。

## 临时皮肤

URL 中的 `skin` 只在当前页面生命周期生效：

- 加载前暂时覆盖主题存储；
- `pagehide` 时恢复原主题；
- 不把开发预览永久写成用户选择。

## Starter 示例

未注册示例位于：

```text
examples/starter-pack/
```

包含：

- 两种 layout；
- 单段固定速度；
- 两段正反转；
- presentation 和 tags；
- 完整使用说明。

示例通过正式 Schema 与 PackValidator，但不出现在 `packs/index.json`，不会被运行时自动发现，也不会进入 Pages 发布目录。

创建正式包仍推荐：

```bash
npm run pack -- create my-pack --title "My Pack" --register
```

## 验证

Node 回归覆盖参数解析、临时皮肤恢复、非法输入拒绝、CLI URL 规范化和 starter 示例校验。

Chromium 流程覆盖：

- URL 直达 stable test route；
- URL 直达指定实验室章节；
- 请求皮肤生效；
- 无效关卡留在 BootScene 错误面。

所有 GitHub Actions 仍只允许手动 `workflow_dispatch`。
