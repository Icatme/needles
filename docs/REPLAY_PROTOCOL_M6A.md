# M6A · Replay Protocol v1

## 目标

`needles.replay/v1` 用于在不依赖 Phaser、Canvas、DOM 或浏览器存储的环境中重建一次游戏过程。

回放不记录每一帧，只记录影响状态机的命令及其单调时间：

- `begin-shot`
- `resolve-impact`
- `release-shot-lock`

`ReplayRunner` 在命令之间调用 `GameSession.advance(deltaMs)`，由现有 RhythmManager 的精确积分重建转盘角度。

## 组件

### ReplayProtocol

负责：

- schema 与 engine version；
- 关卡玩法内容描述；
- 稳定规范化 JSON；
- 32 位 FNV-1a 内容摘要；
- 关卡内容哈希；
- 回放结构、时间单调性和 digest 校验；
- 深冻结输出。

哈希用于发现意外漂移和篡改，不作为密码学签名。

### ReplayRecorder

包装一个纯 `GameSession`：

```js
const recorder = new ReplayRecorder(levelConfig);

recorder.advance(1000);
recorder.beginShot();
recorder.advance(120);
recorder.resolveImpact();

const replay = recorder.export();
```

`advance()` 不产生回放命令，因此正常 60 FPS 运行不会生成逐帧数据。只有状态机命令进入 `commands`。

### ReplayRunner

```js
const parsed = JSON.parse(savedReplay);
const result = new ReplayRunner().run(parsed, levelConfig);
```

重放前验证：

- replay schema；
- engine version；
- replay digest；
- pack ID；
- pack version；
- stable level ID；
- gameplay content hash。

运行过程中逐条验证命令结果，结束后验证最终状态、转盘角度、已插针、碰撞对象和领域事件摘要。

## 顶层结构

```json
{
  "schema": "needles.replay/v1",
  "engineVersion": "classic-v1",
  "level": {
    "packId": "balanced-v2",
    "packVersion": "1.0.0",
    "levelId": "balanced-v2-01",
    "order": 1,
    "contentHash": "1234abcd"
  },
  "geometry": {
    "impactAngle": 1.570796326795,
    "ringRadius": 172,
    "needleRadius": 15,
    "obstacleRadius": 17
  },
  "durationMs": 2590,
  "commands": [],
  "final": {},
  "digest": "89abcdef"
}
```

正式 JSON Schema 位于：

```text
schemas/replay.v1.schema.json
```

## 稳定性边界

- 数值在摘要和最终结果中规范化到 12 位小数；
- 对象键排序，数组顺序保留；
- pack version 默认必须完全一致；
- 可通过 `ignorePackVersion: true` 仅在明确确认内容哈希相同的迁移场景中放宽版本；
- 关卡内容哈希只包含 needleCount、obstacleAngles 和 rhythm，不包含名称、文案、难度分析或视觉表现。

## 非目标

M6A 不负责：

- 自动把浏览器游戏接到 Recorder；
- 本地试玩列表与导出 UI；
- 远程上传；
- 玩家身份；
- 视频录制；
- 密码学签名。

这些能力分别由 M6B、M6C 和以后可能的服务端版本承担。
