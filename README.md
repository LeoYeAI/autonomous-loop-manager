# autonomous-loop-manager

**让 Agent 拥有跨 Session 的目标追求能力。**

目标记忆、失败记忆、策略进化，三位一体让 Agent 越用越聪明。

[English](#english) | [中文](#中文)

---

## 中文

### 核心概念

| 记忆层 | 存什么 | 解决什么问题 |
|--------|--------|-------------|
| **目标记忆** (goals) | 用户目标、分解步骤、当前进度 | 跨 session 继续追求同一目标 |
| **失败记忆** (reflections) | 踩过的坑、失败原因、任务反思 | 下次自动避开同类错误 |
| **策略进化** (strategies) | 有效打法、上下文、成功次数 | 越用越聪明，不重复发明轮子 |

### 安装

```bash
clawhub install autonomous-loop-manager
```

或手动：
```bash
git clone https://github.com/LeoYeAI/autonomous-loop-manager.git \
  ~/.openclaw/workspace/skills/autonomous-loop-manager
```

初始化 memory 文件：
```bash
cd ~/.openclaw/workspace/skills/autonomous-loop-manager/memory
cp goals.example.json goals.json
cp strategies.example.json strategies.json
cp reflections.example.json reflections.json
```

**要求：** Node.js 18+

### 使用方式

把 `loop-prompt.md` 内容注入到 Agent 的 system prompt，之后直接用自然语言：

```
"帮我做一个完整的商业计划书"
"继续上次的任务"
"这个方向不行，换一个"
"你做到哪了？"
```

### 工具一览

| 工具 | 命令 | 说明 |
|------|------|------|
| `goal-track` | `node tools/goal-track.js <cmd>` | 创建/更新/查询目标 |
| `reflect` | `node tools/reflect.js <cmd>` | 写入/查询反思记录 |
| `strategy` | `node tools/strategy.js <cmd>` | 管理策略库 |
| `recall` | `node tools/recall.js <cmd>` | 按需加载（省 token）|
| `status` | `node tools/status.js <user_id>` | 整体状态报告 |
| `plan` | `node tools/plan.js <任务描述>` | 生成有记忆的执行计划 |

### recall — 按需加载（v1.1 新增）

解决 memory 越积越多、全量注入上下文爆 token 的问题。

```bash
# 只输出一行式清单（注入 system prompt 用这个）
node tools/recall.js manifest <user_id>

# 看到相关条目后，再按需展开全文
node tools/recall.js expand strategy <id>
node tools/recall.js expand reflection <id>
node tools/recall.js expand goal <id>

# 跨三类记忆搜索
node tools/recall.js search "关键词"
```

### 文件结构

```
autonomous-loop-manager/
├── SKILL.md              # Skill 元信息
├── _meta.json            # 工具注册表
├── loop-core.sh          # 统一入口（loop <command>）
├── loop-prompt.md        # Agent 思维框架（注入 system prompt）
├── memory/
│   ├── goals.json        # 目标 & 进度（本地，不提交）
│   ├── reflections.json  # 反思记录（本地，不提交）
│   └── strategies.json   # 策略库（本地，不提交）
└── tools/
    ├── lib/store.js      # 原子写 + 文件锁（共享存储层）
    ├── goal-track.js
    ├── reflect.js
    ├── strategy.js
    ├── recall.js         # v1.1 新增
    ├── status.js
    └── plan.js
```

### Changelog

**v1.1.0**
- 新增 `recall.js`：清单注入 + 按需展开，解决 token 规模化问题
- 全部工具改原子写 + 目录文件锁（`lib/store.js`），消除并发写丢数据风险
- 修复 `plan.js` 崩溃 bug（`user_id:` 命中正则时 Assignment to constant variable）
- loop-prompt.md 加入按需加载纪律

**v1.0.0**
- 初始版本：goal-track / reflect / strategy / status / plan

---

## English

### What is this?

A skill for OpenClaw agents that provides **cross-session goal pursuit**: the agent remembers what it's working toward, where it left off, what failed, and what strategies worked.

### Three memory layers

- **Goal memory** — tracks active goals, decomposition, progress across sessions
- **Failure memory** — records what went wrong and why, prevents repeating mistakes  
- **Strategy evolution** — accumulates effective approaches, ranked by success count

### Install

```bash
clawhub install autonomous-loop-manager
```

Or manually:
```bash
git clone https://github.com/LeoYeAI/autonomous-loop-manager.git \
  ~/.openclaw/workspace/skills/autonomous-loop-manager
```

Initialize memory:
```bash
cd memory
cp goals.example.json goals.json
cp strategies.example.json strategies.json
cp reflections.example.json reflections.json
```

**Requires:** Node.js 18+

### Key feature: on-demand loading (v1.1)

Memory grows over time. Injecting all of it into context causes token overflow. `recall.js` solves this:

```bash
# Inject only a one-line manifest into system prompt
node tools/recall.js manifest <user_id>

# When a line looks relevant, expand full content on demand
node tools/recall.js expand strategy|reflection|goal <id>

# Cross-memory keyword search
node tools/recall.js search "keyword"
```

### Technical notes

- **Zero dependencies** — plain Node.js, no npm install needed
- **Atomic writes** — all tools use tmp-file + fsync + rename via `lib/store.js`
- **File locking** — mkdir-based lock prevents concurrent write corruption
- **Memory files are local** — `.gitignore`d, never committed

---

## License

MIT
