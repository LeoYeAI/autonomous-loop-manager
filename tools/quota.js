#!/usr/bin/env node
// quota.js - 每轮执行前的 gate：该不该跑？
// 返回 { should_run, state, reason, ... }

const fs = require('fs');
const path = require('path');
const { goalDir, goalFilePath, readJsonFile, readJsonl, GOALS_DIR } = require('./lib/store');

const REGISTRY = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory/goals.json'
);

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')); } catch (_) { return []; }
}

function getGoal(goalId) {
  return readRegistry().find(g => g.goal_id === goalId) || null;
}

function getOpenGates(goalId) {
  const p = goalFilePath(goalId, 'gates.json');
  const gates = readJsonFile(p, []);
  return gates.filter(g => g.status === 'open');
}

function getRecentRuns(goalId, hours = 24) {
  const p = goalFilePath(goalId, 'run-history.jsonl');
  const all = readJsonl(p);
  const since = Date.now() - hours * 3600 * 1000;
  return all.filter(r => new Date(r.started_at).getTime() > since);
}

function shouldRun(goalId) {
  const goal = getGoal(goalId);
  if (!goal) {
    return { should_run: false, state: 'not_found', reason: `目标不存在: ${goalId}` };
  }

  if (goal.status === 'completed') {
    return { should_run: false, state: 'completed', reason: '目标已完成' };
  }
  if (goal.status === 'paused') {
    return { should_run: false, state: 'paused', reason: '目标已暂停，等待用户恢复' };
  }

  // 检查 user gate
  const openGates = getOpenGates(goalId);
  if (openGates.length > 0) {
    const gate = openGates[0];
    return {
      should_run: false,
      state: 'operator_gate',
      reason: '等待用户决策',
      gate_id: gate.gate_id,
      gate_prompt: gate.question,
      gate_context: gate.context,
      bypass_allowed: gate.bypass_allowed || false,
      bypass_scope: gate.bypass_scope || null,
    };
  }

  // 检查 waiting_external
  if (goal.waiting_on === 'external') {
    return {
      should_run: false,
      state: 'waiting_external',
      reason: goal.waiting_reason || '等待外部信号',
      allow_probe: true,
      probe_command: goal.probe_command || null,
    };
  }

  // 检查空转 stall
  const recent = getRecentRuns(goalId, 24);
  const noProgress = recent.filter(r => r.delivery_outcome === 'no_change').length;
  if (noProgress >= 3) {
    return {
      should_run: false,
      state: 'stall_detected',
      reason: `连续 ${noProgress} 轮无实质进展，需要用户介入或策略切换`,
      recommended_action: '告知用户当前卡点，请求决策或换方向',
      recent_run_count: recent.length,
    };
  }

  const activeStatePath = goalFilePath(goalId, 'ACTIVE_STATE.md');
  return {
    should_run: true,
    state: 'eligible',
    goal_id: goalId,
    goal_text: goal.goal_text,
    active_state_path: activeStatePath,
    recent_runs_24h: recent.length,
  };
}

function listActive() {
  const goals = readRegistry().filter(g => g.status === 'active');
  const results = goals.map(g => {
    const r = shouldRun(g.goal_id);
    return { goal_id: g.goal_id, goal_text: g.goal_text, quota: r };
  });
  console.log(JSON.stringify(results, null, 2));
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'should-run': {
    const result = shouldRun(args[0]);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'list-active':
    listActive();
    break;
  default:
    console.log('Usage: quota.js <should-run <goal_id> | list-active>');
}
