# M8B · 难度人工复查工作表

## 目标

把三类信息放到同一张工作表：

1. M8A campaign 的 pilot 就绪状态；
2. M6C 匿名试玩指标；
3. 当前关卡包的预测难度和参数上下文。

输出用于决定“先补数据还是人工复查”，不自动修改针数、速度、障碍或节奏。

## 命令

```bash
npm run review:balance -- \
  playtests/campaigns/balanced-v2-anchor-v1.json \
  downloads/ \
  --json reports/balance-review.json \
  --html reports/balance-review.html
```

输出 Schema：

```text
schemas/balance-review.v1.schema.json
```

## 数据门禁

顶层 `dataGate`：

- `collect-more-data`：至少一个锚点尚未达到 pilot 操作目标；
- `pilot-complete`：全部锚点达到 M8A 中定义的尝试和匿名来源目标。

即使为 `pilot-complete`，也只代表可以开始完整人工复查，不代表关卡已经统计验证正确。

## 数据采集队列

未达到 pilot 的锚点只进入 `collectionQueue`，显示：

- 当前尝试数；
- 当前匿名来源数；
- 尚缺尝试；
- 尚缺来源；
- 选择原因；
- 直达试玩 URL。

排序规则：

1. readiness 升序；
2. 总缺口降序；
3. order 升序。

## 人工复查队列

达到 pilot 的锚点进入 `reviewQueue`。

透明排序规则：

1. 预测/实际相对排名偏差绝对值降序；
2. 与有数据相邻关的失败率变化绝对值降序；
3. 失败率降序；
4. order 升序。

没有合成不可解释的“风险分”。排序字段原样写入 `transparentSort`。

## 相对判断

- `harder-than-predicted-relative-position`
- `easier-than-predicted-relative-position`
- `aligned-relative-position`
- `insufficient-relative-data`

这里只比较同一批样本、同一个包内的相对顺序。它不生成绝对真人难度分。

## 参数上下文

每个复查锚点附带：

- needleCount；
- obstacleCount 与 layout ID；
- segmentCount；
- shortestSegmentMs；
- peakAbsSpeed；
- directionChanges；
- shotModifier；
- presentation 与 tags；
- 前一关和后一关的相同参数与预测分；
- 邻关有样本时的实际指标。

这些字段让人工判断问题来自密度、分区、速度、短相位、反转还是击中后状态变化。

## 明确不做

工作表不会输出：

- 建议针数；
- 建议速度；
- 自动 patch；
- 自动重排；
- “统计显著”结论；
- 自动合并到 balanced-v2。

任何参数修改都必须在真人数据、回放和相邻关上下文基础上单独审查，并通过 M7B audit/report/diff。

所有 GitHub Actions 继续只允许手动 `workflow_dispatch`。
