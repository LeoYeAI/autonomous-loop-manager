#!/usr/bin/env node
// goal-track.js v2 - 目标追踪 + ACTIVE_STATE.md 仪表盘
// 注册表保持 goals.json 扁平索引，每个目标的细节落到 goals/<id>/ 目录

const { update, readJson, genId, goalDir } = require('./lib/store');
const { renderActiveState } = require('./lib/state');

const FILE = 'goals.json';

function createGoal(goalText, userId, objective) {
  const goalId = genId('goal');
  const timestamp = new Date().toISOString();
  update(FILE, (goals) => {
    goals.push({
      goal_id: goalId,
      user_id: userId,
      goal_text: goalText,
      objective: objective || goalText,
      status: 'active',
      waiting_on: 'agent',
      created_at: timestamp,
      updated_at: timestamp,
      current_step: '',
      critic: '',
      // 兼容 v1 字段
      decomposition: [],
      completed_steps: [],
      failed_attempts: [],
      context: {},
    });
    return goals;
  });
  goalDir(goalId); // 建目录
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok: true, goal_id: goalId }, null, 2));
  return goalId;
}

function setField(goalId, field, value) {
  let ok = false;
  update(FILE, (goals) => {
    const g = goals.find(x => x.goal_id === goalId);
    if (g) {
      if (field === 'completed_step') { g.completed_steps.push(value); g.current_step = value; }
      else g[field] = value;
      g.updated_at = new Date().toISOString();
      ok = true;
    }
    return goals;
  });
  if (ok) renderActiveState(goalId);
  console.log(JSON.stringify({ ok, field }, null, 2));
}

function status(goalId) {
  const g = readJson(FILE).find(x => x.goal_id === goalId);
  console.log(JSON.stringify(g || { error: 'not found' }, null, 2));
}

function active(userId) {
  const a = readJson(FILE).find(g => g.user_id === userId && g.status === 'active');
  console.log(a ? JSON.stringify(a, null, 2) : 'null');
}

function list(userId) {
  console.log(JSON.stringify(readJson(FILE).filter(g => g.user_id === userId), null, 2));
}

function refreshState(goalId) {
  const md = renderActiveState(goalId);
  console.log(md || JSON.stringify({ error: 'not found' }));
}

function complete(goalId) {
  setField(goalId, 'status', 'completed');
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'create':
    createGoal(args[0], args[1], args[2]);
    break;
  case 'set':
    setField(args[0], args[1], args.slice(2).join(' '));
    break;
  case 'status':
    status(args[0]);
    break;
  case 'active':
    active(args[0]);
    break;
  case 'list':
    list(args[0]);
    break;
  case 'refresh-state':
    refreshState(args[0]);
    break;
  case 'complete':
    complete(args[0]);
    break;
  default:
    console.log('Usage: goal-track.js <create|set|status|active|list|refresh-state|complete>');
    console.log('  create <goal_text> <user_id> [objective]');
    console.log('  set <goal_id> <field> <value>   (fields: status, waiting_on, current_step, critic, objective, completed_step)');
    console.log('  refresh-state <goal_id>          重新渲染 ACTIVE_STATE.md');
}
