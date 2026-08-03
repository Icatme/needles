# M8A · Balanced V2 锚点试玩 Campaign

## 为什么先做锚点

没有必要要求每位测试者连续打完 50 关。第一轮先覆盖 15 个代表性位置：

```text
1、3、5、7、9、10、12、15、20、25、30、35、40、45、50
```

重点包括：

- 第 9 → 10 关；
- 各章节适应点、中点和里程碑；
- 最终耐力关。

只有锚点数据显示异常时，再扩展其前后关卡。

## Campaign 文件

```text
playtests/campaigns/balanced-v2-anchor-v1.json
```

Schema：

```text
schemas/playtest-campaign.v1.schema.json
```

campaign 固定：

- pack ID 与版本；
- stable level ID；
- order；
- 选择原因；
- 可选同关号对照包；
- pilot 收集目标。

当前 pilot 操作目标：

- 每个锚点至少 5 次尝试；
- 至少来自 2 个匿名导出文件。

这只表示可以进入人工复查，不代表统计显著性，也不是自动发布阈值。

## 生成测试计划

```bash
npm run campaign -- plan \
  playtests/campaigns/balanced-v2-anchor-v1.json \
  --html reports/anchor-plan.html
```

每个锚点生成：

- balanced-v2 test URL；
- legacy 同 order 对照 URL；
- 选择原因；
- pilot 目标。

URL 复用 M7C 的安全预览入口。

## 查看采集状态

```bash
npm run campaign -- status \
  playtests/campaigns/balanced-v2-anchor-v1.json \
  downloads/ \
  --json reports/anchor-status.json \
  --html reports/anchor-status.html
```

每关状态：

- `unstarted`
- `collecting`
- `pilot-ready`

同时显示：

- 尝试数；
- 匿名来源数；
- 成功/失败数量；
- 是否同时观察到成功和失败；
- 还缺多少尝试与来源；
- 旧版本数据数量。

与 campaign packVersion 不同的数据不计入当前 pilot，并单独报告为 stale version。

## 推荐下一关

```bash
npm run campaign -- next \
  playtests/campaigns/balanced-v2-anchor-v1.json \
  downloads/
```

选择规则：

1. 排除已经 pilot-ready 的锚点；
2. 优先 readiness 最低的关卡；
3. 同等 readiness 下优先缺口更大；
4. 再按 order 升序。

因此首轮会优先铺开锚点覆盖，而不是无限集中于单一关卡。

## 数据边界

- 输入仍是匿名 `needles.playtest-export/v1`；
- 不需要账号、玩家 ID 或设备 ID；
- 不远程上传；
- 不自动改关卡参数；
- 不把 pilot-ready 解释为“关卡已验证正确”。

所有 GitHub Actions 继续只允许手动 `workflow_dispatch`。
