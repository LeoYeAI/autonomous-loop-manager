#!/usr/bin/env node
// daily-review.js - 每日进展审计 + 推送摘要给用户
// 供 cron job 每天结束时调用

const fs = require('fs');
const path = require('path');
const { readJson, readJsonFile, goalFilePath, readJsonl } = require('./lib/store');

const REGISTRY = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory/goals.json'
);

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')); } catch (_) { return []; }
}

function reviewGoal(goal, hours = 24) {
  const goalId = goal.goal_id;
  const histPath = goalFilePath(goalId, 'run-history.jsonl');
  const all = readJsonl(histPath);
  const since = Date.now() - hours * 3600 * 1000;
  const recent = all.filter(r => new Date(r.started_at).getTime() > since);

  const todos = readJsonFile(goalFilePath(goalId, 'todos.json'), []);
  const gates = readJsonFile(goalFilePath(goalId, 'gates.json'), []);
  const openGates = gates.filter(g => g.status === 'open');
  const unansweredGates = gates.filter(g => g.status === 'open' && g.notified);

  const runsTotal = recent.length;
  const runsProgress = recent.filter(r => r.delivery_outcome === 'outcome_progress').length;
  const runsNoChange = recent.filter(r => r.delivery_outcome === 'no_change').length;
  const todosCompleted = recent.reduce((a, r) => a + (r.todos_completed || []).length, 0);
  const todosAdded = recent.reduce((a, r) => a + (r.todos_added || []).length, 0);
  const tokenEstimate = recent.reduce((a, r) => a + (r.token_estimate || 0), 0);

  const openTodos = todos.filter(t => t.status !== 'done').length;
  const lastRun = all.length ? all[all.length - 1] : null;

  let velocity = 'stable';
  if (runsNoChange >= 3) velocity = 'stalled';
  else if (runsProgress > runsNoChange) velocity = 'advancing';
  else if (runsNoChange > runsProgress) velocity = 'slowing';

  let recommendation = '';
  if (openGates.length > 0) {
    recommendation = `优先回答 ${openGates.length} 个待决策问题，否则相关 todo 无法推进`;
  } else if (velocity === 'stalled') {
    recommendation = '已连续多轮无进展，建议重新规划策略或调整目标范围';
  } else if (todosAdded > todosCompleted * 2) {
    recommendation = '新增 todo 远多于完成量，任务在膨胀，建议裁剪范围';
  } else if (runsProgress > 0) {
    recommendation = `进展健康，继续推进。下一步：${lastRun?.next_action || '见 ACTIVE_STATE.md'}`;
  } else {
    recommendation = '今日无实质运行，请检查 cron 配置或手动触发';
  }

  return {
    date: new Date().toISOString().split('T')[0],
    goal_id: goalId,
    goal_text: goal.goal_text,
    status: goal.status,
    window_hours: hours,
    runs_total: runsTotal,
    runs_with_progress: runsProgress,
    runs_no_progress: runsNoChange,
    todos_open: openTodos,
    todos_completed_today: todosCompleted,
    todos_added_today: todosAdded,
    open_gates: openGates.length,
    token_estimate: tokenEstimate,
    progress_velocity: velocity,
    top_blocker: openGates.length ? openGates[0].question : null,
    recommendation,
    last_next_action: lastRun?.next_action || null,
  };
}

function formatSummary(reviews) {
  if (!reviews.length) return '今日无活跃目标。';
  const lines = ['📊 **每日进展报告**', ''];
  for (const r of reviews) {
    const vel = { advancing: '🟢 推进中', stable: '🟡 稳定', slowing: '🟠 放缓', stalled: '🔴 卡住了' }[r.progress_velocity] || r.progress_velocity;
    lines.push(`**${r.goal_text}** ${vel}`);
    lines.push(`  今日运行 ${r.runs_total} 轮 | 有进展 ${r.runs_with_progress} | 无变化 ${r.runs_no_progress}`);
    lines.push(`  完成 ${r.todos_completed_today} 个 todo | 新增 ${r.todos_added_today} | 待办 ${r.todos_open} 个`);
    if (r.open_gates > 0) lines.push(`  ⚠️ ${r.open_gates} 个待回答问题：${r.top_blocker}`);
    lines.push(`  💡 ${r.recommendation}`);
    lines.push('');
  }
  return lines.join('\n');
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'run': {
    const userId = args[0] || null;
    const hours = args[1] ? parseInt(args[1], 10) : 24;
    const goals = readRegistry().filter(g => g.status === 'active' && (!userId || g.user_id === userId));
    const reviews = goals.map(g => reviewGoal(g, hours));
    console.log(JSON.stringify(reviews, null, 2));
    break;
  }
  case 'summary': {
    const userId = args[0] || null;
    const hours = args[1] ? parseInt(args[1], 10) : 24;
    const goals = readRegistry().filter(g => g.status === 'active' && (!userId || g.user_id === userId));
    const reviews = goals.map(g => reviewGoal(g, hours));
    console.log(formatSummary(reviews));
    break;
  }
  default:
    console.log('Usage: daily-review.js <run|summary> [user_id] [hours=24]');
}
