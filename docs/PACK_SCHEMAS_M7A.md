# M7A · 正式关卡包 Schema

## 四类关卡包 Schema

```text
schemas/pack-index.v1.schema.json
schemas/level-pack.v1.schema.json
schemas/level-presets.v1.schema.json
schemas/level-list.v1.schema.json
```

分别对应：

- `packs/index.json`
- `packs/*/manifest.json`
- `packs/*/presets.json`
- `packs/*/levels.json`

Schema 使用 JSON Schema Draft 2020-12，并对已定义对象启用 `additionalProperties: false`。关卡包仍然是纯数据，不能声明任意脚本或可执行插件。

## 校验分层

### JSON Schema

负责单文件结构：

- 必填字段；
- ID 格式；
- 数字范围；
- rhythm segment 的互斥结构；
- shotModifier 依赖字段；
- presentation 与 tags；
- 未知字段拒绝。

### PackValidator

负责跨文件关系：

- 默认包必须出现在 index；
- manifest ID 必须与 index entry 相同；
- pack ID 重复；
- chapter ID 与 order 重复；
- level ID 与 order 重复；
- level.chapterId 必须存在；
- layoutRef 必须指向当前包内布局；
- 运行时 engineCompatibility。

两层都通过，包才是可装载状态。

## 命令行

安装开发依赖后运行：

```bash
npm run validate:packs
```

输出机器可读 JSON，包括：

- 默认包；
- 包数量；
- 总关卡数；
- 每包版本、章节、布局、关卡数量和资源文件路径。

## VS Code

`.vscode/settings.json` 使用 `json.schemas` 将 pack 文件模式映射到本地 Schema。编辑 JSON 时可获得：

- 自动补全；
- 字段说明；
- 类型与范围错误提示；
- 未知字段提示。

没有把 `$schema` 写进生成的业务 JSON，因此 `scripts/export-level-packs.js --check` 的确定性输出不受影响。

## 手动 CI

`Tests` workflow 仍只声明 `workflow_dispatch`，但现在会：

1. `npm install`；
2. 运行全部 Node 测试；
3. 运行 `npm run validate:packs`。

没有增加 push、pull_request、schedule 或其他自动触发。
