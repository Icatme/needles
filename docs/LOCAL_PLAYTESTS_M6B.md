# M6B · 本地试玩记录

## 记录边界

只有从关卡实验室进入的 `mode: test` 会记录试玩。正常进度 `mode: progression` 继续直接使用 `GameSession`，不创建试玩记录。

测试模式使用 `PlaytestSession`，它保持与 `GameSession` 相同的调用接口：

- `advance`
- `beginShot`
- `resolveImpact`
- `releaseShotLock`
- `getSnapshot`
- `status`

因此 GameScene 不需要重新实现玩法分支。

## 每次记录包含

- pack ID 与版本；
- stable level ID 与显示顺序；
- 预测难度分；
- 最多三个主要难度驱动；
- 成功或失败；
- 试玩持续时间；
- 已插针数与总针数；
- 失败发生在哪一针；
- 碰撞类型与目标 ID；
- 每次成功接受发射的时间；
- 相邻发射间隔；
- 完整 `needles.replay/v1` 回放。

试玩在完成或碰撞发生时落盘。中途离开关卡不会产生一条不完整记录。

## 本地存储

`PlaytestStore` 使用：

```text
needle_game_playtests_v1
```

默认最多保留最近 250 次尝试，超过后移除最早记录。记录只保存在当前浏览器，不远程上传。

导出结构：

```text
needles.playtest-export/v1
```

正式 Schema 位于：

```text
schemas/playtest-export.v1.schema.json
```

导出内容不包含姓名、邮箱、玩家 ID、设备 ID、IP 地址或账号信息。

## 关卡实验室操作

关卡实验室顶部增加：

- **导出记录**；
- **清空记录**；
- 当前本地记录条数。

键盘快捷键：

- `E`：下载 `needles-playtests-YYYY-MM-DD.json`；
- `C`：清空本地试玩记录。

## Chromium 验证

新增浏览器流程覆盖：

1. 通过网络拦截注入一针测试包；
2. 从实验室进入 test route；
3. 完成关卡并生成本地记录；
4. 使用 ReplayRunner 验证保存的回放；
5. 下载 JSON 并解析；
6. 清空记录并确认计数归零。

所有 GitHub Actions 仍仅支持手动 `workflow_dispatch`。
