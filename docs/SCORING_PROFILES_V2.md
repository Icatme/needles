# Scoring Profiles V2

评分配置由 `ScoringProfileResolver` 在关卡配置完成难度分析后生成。每一关都会得到独立的、可复现的评分档案，档案标识为：

```text
<packId>@<packVersion>:<levelId>:score-v2:<ruleHash>
```

`ruleHash` 由最终归一化的评分规则生成。关卡包版本或评分规则变化时，
档案标识也会变化，旧公式下的本机成绩和幽灵不会与新公式混用。

## 为什么改为节奏连击

旧版连击只统计“连续成功插针”。由于碰撞会直接结束一局，完整通关时各玩家的连击长度通常接近，区分度有限。

V2 使用节奏窗口：

- 第一针开启连击窗口；
- 下一针在窗口结束前命中，连击继续；
- 超时后连击归零，下一针重新起拍；
- 单侧贴边会获得半段精准宽限；
- 双侧穿隙会获得完整精准宽限；
- 超时不会扣除已经获得的分数。

HUD 会显示剩余节奏时间，低于 0.7 秒时切换为警示色。

## 每关派生参数

解析器读取以下关卡数据：

- 平均转速；
- 最差完整机会覆盖时间；
- 节奏压力与逐针状态变化压力；
- 空间密度；
- 难度等级；
- 针数与障碍数量。

由此派生：

- `comboWindowMs`：节奏连击窗口；
- `comboPrecisionGraceMs`：精准命中的额外宽限；
- `precisionClearancePx`：贴边判定阈值；
- `comboStepPoints`：连击每级奖励；
- `parTimePerNeedleMs` 与 `parTimeMs`：本关基准时间。

所有派生值均经过上下限约束与固定步长取整，保证同一关卡配置在浏览器、测试和未来服务端验证中一致。

## 关卡作者覆盖

`levels.json` 的单个关卡可以增加 `scoring`：

```json
{
  "scoring": {
    "comboWindowMs": 2850,
    "comboPrecisionGraceMs": 500,
    "precisionClearancePx": 10,
    "parTimeMs": 26400
  }
}
```

作者值会覆盖派生值；未填写的项目仍使用该关卡的派生结果。Schema 只允许正式支持的评分字段，避免拼写错误静默失效。

## 架构边界

- 评分档案不修改碰撞结果、旋转或关卡状态机；
- `ScoreSession` 只消费已经解析好的档案；
- 分数表仍然按关卡保存，不进行跨关总分混排；
- 档案中的 `diagnostics` 只用于调试和调参，不参与最终得分计算。
