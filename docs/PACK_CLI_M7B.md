# M7B · Level Pack CLI

统一入口：

```bash
npm run pack -- <command>
```

所有命令先使用 M7A 的 JSON Schema 和 PackValidator。需要运行时关卡形状的命令，再通过 LevelResolver 与 manifest 指定的 DifficultyManager 执行。

## validate

```bash
npm run pack -- validate
```

验证整个 `packs/index.json` 及其注册包，输出包数、关卡数、章节、布局和文件路径。

## audit

```bash
npm run pack -- audit balanced-v2
npm run pack -- audit balanced-v2 --json reports/audit.json
```

逐关输出：

- 结构与关系是否合法；
- errors / warnings；
- 预测难度；
- 主要难度驱动；
- 容量摘要；
- 全角机会摘要。

## score

```bash
npm run pack -- score balanced-v2
```

输出适合脚本消费的精简难度曲线：stable level ID、order、章节、分数和前三个驱动。

## report

```bash
npm run pack -- report balanced-v2 \
  --json reports/balanced-v2.json \
  --html reports/balanced-v2.html
```

生成：

- 包与章节统计；
- 难度范围；
- 逐关曲线；
- 相邻关分数变化；
- 单文件 HTML 表格报告。

## diff

```bash
npm run pack -- diff balanced-v2 path/to/candidate-pack
```

左右参数都可以是已注册 pack ID，也可以是包目录或 manifest 路径。

按 stable level ID 输出：

- added；
- removed；
- changed；
- 变化字段；
- 变化前后内容哈希。

比较字段包括 order、chapter、标题、说明、针数、布局、节奏、表现语义和 tags。

## create

```bash
npm run pack -- create tutorial-pack \
  --title "教学包" \
  --caption "最小关卡包" \
  --register
```

生成：

```text
packs/tutorial-pack/
  manifest.json
  presets.json
  levels.json
```

starter pack 只有一个无障碍一针关卡，全部为 JSON，不生成 JavaScript 或插件文件。

默认不修改 `packs/index.json`；明确传入 `--register` 才注册。目标目录已存在时拒绝覆盖。

## Root 参数

工具默认使用当前仓库：

```bash
npm run pack -- validate --root /path/to/needles
```

适合测试临时副本或比较外部候选包。

## 安全边界

- 不执行包内代码；
- 不加载任意 renderer；
- 不访问网络；
- 不修改现有包，除非执行 `create --register`；
- HTML 报告对作者文本转义。

所有 GitHub Actions 仍只允许手动 `workflow_dispatch`。
