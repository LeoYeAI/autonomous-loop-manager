#!/usr/bin/env node
// cron-bridge.js - 为 OpenClaw cron 生成 heartbeat payload
// 用法：
//   node cron-bridge.js heartbeat-prompt <goal_id>   生成单次心跳 prompt
//   node cron-bridge.js setup <goal_id> [interval_ms]  输出 cron job JSON（用于 OpenClaw cron tool）
//   node cron-bridge.js setup-all [user_id]            为所有活跃目标生成 cron jobs

const fs = require('fs');
const path = require('path');
const { goalFilePath, readJsonFile, readJsonl } = require('./lib/store');

const REGISTRY = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory/goals.json'
);
const TOOLS_DIR = path.dirname(require.resolve('./quota.js'));

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')); } catch (_) { return []; }
}

function heartbeatPrompt(goalId) {
  const ACTIVE_STATE = goalFilePath(goalId, 'ACTIVE_STATE.md');
  const stateExists = fs.existsSync(ACTIVE_STATE);
  const stateContent = stateExists ? fs.readFileSync(ACTIVE_STATE, 'utf-8') : '（尚未生成）';

  return `## Autonomous Loop Heartbeat
**Goal ID**: ${goalId}
**Time**: ${new Date().toISOString()}

---

### Step 0: Quota Check（必须先执行）

\`\`\`
node ${TOOLS_DIR}/quota.js should-run ${goalId}
\`\`\`

根据结果：
- **should_run=false, state=operator_gate**：通过 Telegram 通知用户需要决策，附上 gate_prompt。执行后输出 NOTIFY。
- **should_run=false, state=stall_detected**：通知用户当前卡点，请求介入或换方向。输出 NOTIFY。
- **should_run=false, state=waiting_external**：执行 probe_command（只读），无变化则输出 DONT_NOTIFY，静默结束。
- **should_run=false, 其他**：静默结束，输出 DONT_NOTIFY。
- **should_run=true**：继续下面的步骤。

---

### Step 1: 读取当前状态（不靠记忆，靠文件）

当前 ACTIVE_STATE.md 内容：

${stateContent}

---

### Step 2: 执行审计（开始干活前）

列出 3 个可能的下一步，选择最高价值的一个，说明原因。
检查：这件事在 Scope 边界内吗？前置条件满足了吗？

\`\`\`
node ${TOOLS_DIR}/todo.js list-actionable ${goalId}
\`\`\`

---

### Step 3: 执行一个 Bounded Segment

- 只做一件事，做完整，做可验证
- 遇到需要用户决策的点，立即：
  \`\`\`
  node ${TOOLS_DIR}/gate.js add ${goalId} --question "..." --context "..." --blocking true
  \`\`\`
- 不要猜，不要假设用户的选择

---

### Step 4: 强制 Writeback（不可跳过）

完成后必须执行：

\`\`\`bash
# 1. 完成 todo（带证据）
node ${TOOLS_DIR}/todo.js complete ${goalId} <todo_id> <session_id> "<完成的证据>"

# 2. 记录本轮执行
node ${TOOLS_DIR}/evidence.js record ${goalId} \\
  --classification advancement \\
  --delivery_outcome outcome_progress \\
  --validation_summary "<验证结果>" \\
  --next_action "<下一步>"

# 3. 刷新 ACTIVE_STATE.md
node ${TOOLS_DIR}/goal-track.js refresh-state ${goalId}
\`\`\`

---

### Step 5: 自我评估

这一轮是 advancement 还是 no_progress？
- 如果是 no_progress：delivery_outcome 写 no_change，诚实记录
- 如果有实质进展：输出 NOTIFY（一句话告知用户）
- 如果无进展：输出 DONT_NOTIFY
`;
}

function cronJobJson(goalId, intervalMs = 3 * 60 * 1000) {
  const prompt = heartbeatPrompt(goalId);
  return {
    name: `loop-heartbeat-${goalId}`,
    schedule: { kind: 'every', everyMs: intervalMs },
    sessionTarget: 'isolated',
    payload: {
      kind: 'agentTurn',
      message: prompt,
      timeoutSeconds: 300,
    },
    delivery: { mode: 'announce', bestEffort: true },
  };
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'heartbeat-prompt':
    console.log(heartbeatPrompt(args[0]));
    break;
  case 'setup': {
    const goalId = args[0];
    const intervalMs = args[1] ? parseInt(args[1], 10) : 3 * 60 * 1000;
    console.log(JSON.stringify(cronJobJson(goalId, intervalMs), null, 2));
    break;
  }
  case 'setup-all': {
    const userId = args[0] || null;
    const goals = readRegistry().filter(g => g.status === 'active' && (!userId || g.user_id === userId));
    const jobs = goals.map(g => cronJobJson(g.goal_id));
    console.log(JSON.stringify(jobs, null, 2));
    break;
  }
  default:
    console.log('Usage: cron-bridge.js <heartbeat-prompt <goal_id> | setup <goal_id> [interval_ms] | setup-all [user_id]>');
}
