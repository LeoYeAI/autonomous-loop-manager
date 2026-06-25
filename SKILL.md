# Autonomous Loop Manager v2

**让 Agent 拥有横跨数天乃至数月的长程目标追求能力。**

v2 核心升级：吸收 LoopX 控制面思想，把"靠记忆"彻底改成"靠文件"。

---

## 核心原则

> **状态不依赖记忆，依赖文件。**
>
> context 被压缩、session 重启、任务中断都不会让 Agent 失忆——因为真相在 `goals/<id>/` 目录里。

---

## 解决的问题

| 问题 | v1 的做法 | v2 的做法 |
|------|-----------|-----------|
| Agent 忘记目标 | 靠自觉调用 reflect.js | quota check 强制读文件 |
| 不知道该不该跑 | 每轮直接开干 | quota.js should-run gate |
| todo 是字符串 | current_step: "..." | 带 owner/precondition/criteria 的结构化 todo |
| 需要问用户 | Agent 猜 | gate.js 显式队列 |
| 越界操作 | 无防护 | scope.js allows/forbidden/requires_gate |
| 看不清进展 | 无 | ACTIVE_STATE.md 实时仪表盘 |
| 空转 | 无感知 | stall_detected（3轮 no_change 自动触发）|
| 多轮执行记录 | 无 | append-only run-history.jsonl |
| 每日汇报 | 无 | daily-review.js → Telegram |
| 自动触发 | 无 | cron-bridge.js → OpenClaw cron |

---

## 存储结构

```
memory/
├── goals.json                    # 全局注册表（轻量索引）
├── goals/
│   └── <goal_id>/
│       ├── ACTIVE_STATE.md       # 实时仪表盘（人可读）
│       ├── scope.json            # 操作边界
│       ├── todos.json            # 带契约的工作单元
│       ├── gates.json            # 用户决策点队列
│       ├── run-history.jsonl     # append-only 执行记录
│       └── evidence/             # 产出物索引
├── reflections.json              # v1 反思（保留）
└── strategies.json               # v1 策略库（保留）
```

---

## 快速开始

```bash
LOOP=/home/ubuntu/.openclaw/workspace/skills/autonomous-loop-manager/loop-core.sh

# 1. 启动一个长程目标
bash $LOOP start "构建用户认证系统" "leo" "实现完整的注册/登录/JWT流程"

# 2. 分解 todo
bash $LOOP todo add <goal_id> --title "设计数据库schema" --priority P0 --success_criteria "schema文件通过校验"
bash $LOOP todo add <goal_id> --title "实现注册API" --priority P1 --preconditions "<todo_id_1>"

# 3. 接入自动心跳（每3分钟触发一次 isolated subagent）
bash $LOOP cron-bridge setup <goal_id> 180000
# 把输出的 JSON 交给 OpenClaw cron tool 创建 cron job

# 4. 查看状态
bash $LOOP check <goal_id>

# 5. 每日汇报
bash $LOOP daily-review summary leo
```

---

## 模块说明

### 控制面（v2 新增）

**`quota.js should-run <goal_id>`**
每轮必须先调用。返回 `should_run: true/false` + 原因。
- `operator_gate`：有未解决的用户决策点，通知用户
- `stall_detected`：连续 3 轮无进展，请求介入
- `waiting_external`：等外部信号，做只读 probe
- `eligible`：可以执行

**`todo.js`**
工作单元带契约：`priority(P0/P1/P2)` + `task_class(advancement/blocker/gate/monitor)` + `preconditions(依赖)` + `success_criteria(完成标准)` + `claimed_by(owner)`。
`list-actionable` 只返回前置条件已满足的 todo，防止乱序执行。

**`gate.js`**
人类决策点显式队列。`blocking=true` 时 quota 会阻塞 Agent。支持 `bypass_allowed + bypass_scope`：阻塞主路径的同时允许做旁路工作。

**`evidence.js`**
每轮执行后强制写入 `run-history.jsonl`（append-only）。`delivery_outcome: outcome_progress/no_change/regression` 诚实记录，是 stall 检测的数据来源。

**`scope.js`**
操作边界。`allowed`（可以做什么）+ `forbidden`（明确禁止）+ `requires_gate`（需要用户授权才能做）。
`scope.js check <goal_id> "<动作>"` 在执行前验证。

**`cron-bridge.js`**
生成 OpenClaw cron job JSON，包含完整的 heartbeat prompt（5步循环）。每个 isolated subagent 启动时读这个 prompt，自动走完整个控制面协议。

**`daily-review.js`**
每天统计：runs_total/with_progress/no_progress、todos_completed/added、open_gates、velocity(advancing/stable/slowing/stalled)、recommendation。

### 语义记忆层（v1 保留）

**`recall.js`** manifest + expand + search，token 高效召回历史策略和反思。
**`strategy.js`** 成功方法积累，按 success_count 排序。
**`reflect.js`** 任务反思，completed/interrupted/failed 归档。

---

## Agent 行为规范（loop-prompt.md）

每轮必须按顺序执行：
1. `quota.js should-run` — 该不该跑？
2. 读 `ACTIVE_STATE.md` — 当前状态
3. `todo.js list-actionable` — 执行审计
4. 执行一个 bounded segment
5. 强制 writeback（todo complete + evidence record + refresh-state）

**绝不跳过 Step 1 和 Step 5。**

---

## 文件清单

```
autonomous-loop-manager/
├── SKILL.md              # 本文件
├── _meta.json            # 版本 2.0.0
├── loop-core.sh          # 统一入口（含快捷命令）
├── loop-prompt.md        # Agent 思维框架 v2
├── tools/
│   ├── lib/
│   │   ├── store.js      # 共享存储层（原子读写/锁/jsonl）
│   │   └── state.js      # ACTIVE_STATE.md 渲染（共享）
│   ├── quota.js          # 每轮 gate（v2 新增）
│   ├── todo.js           # 带契约工作单元（v2 新增）
│   ├── gate.js           # 用户决策点（v2 新增）
│   ├── evidence.js       # 执行证据记录（v2 新增）
│   ├── scope.js          # 操作边界（v2 新增）
│   ├── cron-bridge.js    # OpenClaw cron 接入（v2 新增）
│   ├── daily-review.js   # 每日进展审计（v2 新增）
│   ├── goal-track.js     # 目标管理（v2 升级）
│   ├── recall.js         # 按需召回（v1 保留）
│   ├── strategy.js       # 策略库（v1 保留）
│   ├── reflect.js        # 反思记录（v1 保留）
│   ├── plan.js           # 计划生成（v1 保留）
│   └── status.js         # 状态报告（v1 保留）
└── memory/
    ├── goals.json         # 全局注册表
    └── goals/             # 每目标状态目录
```
