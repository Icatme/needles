# M6C · 离线试玩分析报告

## 输入

分析器接受一个或多个 `needles.playtest-export/v1` 文件，也可以接受包含多个 JSON 导出的目录。

```bash
npm run report:playtests -- downloads/
```

同时生成 JSON 和 HTML：

```bash
npm run report:playtests -- \
  downloads/ \
  --json reports/playtests.json \
  --html reports/playtests.html \
  --min-samples 5
```

分析完全离线，不上传数据。

## 每关指标

- 尝试次数；
- 成功与失败次数；
- 完成率、失败率；
- 成功耗时中位数；
- 失败时已插针数中位数；
- 失败进度中位数；
- 出针间隔中位数；
- 失败针位分布；
- 碰撞类型分布；
- 预测难度中位数；
- 主要难度驱动；
- 覆盖的匿名导出文件数。

## 完成所需尝试

每个导出文件视为一个匿名测试来源。在同一文件、同一关卡内，按 `recordedAt` 排序：

- 从上一次完成后开始累计尝试；
- 遇到完成时记录本轮尝试数；
- 文件结束仍未完成则计为一次 incomplete run；
- 对所有完成轮次计算尝试数中位数。

因此不需要玩家账号或身份字段，也不会把不同导出文件错误串成同一玩家。

## 预测与实际

报告不生成伪精确“真实难度分”。同一个关卡包内只计算两种相对排名：

- **预测排名**：按 DifficultyModel 输出升序；
- **实际排名**：依次按失败率、完成所需尝试、失败深度和成功耗时排序。

`rankDelta = observedRank - predictedRank`：

- 正值：实际相对位置比预测更难；
- 负值：实际相对位置比预测更容易；
- 仅用于定位需要复查的关卡，不代表统计显著性。

## 低样本

`--min-samples` 默认是 5。低于该数量的关卡仍显示，但标为 `low-sample`；相邻跳幅只有两关都达到门槛时才标为可比较。

这个门槛是报告展示参数，不是通用质量结论，可以按测试规模调整。

## 相邻关跳幅

每组相邻关显示：

- 预测难度差；
- 失败率差；
- 完成所需尝试差；
- 失败进度差；
- 实际排名差。

用于定位“参数曲线平滑，但真人体验突然跳变”的位置。

## V2 / legacy 对照

当输入同时包含 `balanced-v2` 与 `legacy` 时，报告按同一 order 对照：

- 两边样本数；
- 完成率差；
- 完成尝试数差；
- 成功耗时差。

## 输出

- JSON Schema：`schemas/playtest-report.v1.schema.json`
- HTML：单文件、无外部脚本、可直接浏览或归档

所有 GitHub Actions 仍只允许手动 `workflow_dispatch`。分析器本身是本地 CLI，不新增后台任务或自动上传。
