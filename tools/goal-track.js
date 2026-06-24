#!/usr/bin/env node
// goal-track.js - 目标追踪工具（原子写 + 并发安全）

const { readJson, update, genId } = require('./lib/store');

const FILE = 'goals.json';

function createGoal(goalText, userId) {
  const goalId = genId();
  const timestamp = new Date().toISOString();
  update(FILE, (goals) => {
    goals.push({
      goal_id: goalId,
      user_id: userId,
      goal_text: goalText,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
      decomposition: [],
      completed_steps: [],
      current_step: '',
      failed_attempts: [],
      context: {},
    });
    return goals;
  });
  console.log(`✅ 目标已创建: ${goalId}`);
  return goalId;
}

function updateGoal(goalId, step, status = 'active') {
  let ok = false;
  update(FILE, (goals) => {
    const idx = goals.findIndex((g) => g.goal_id === goalId);
    if (idx === -1) return goals;
    goals[idx].completed_steps.push(step);
    goals[idx].current_step = step;
    goals[idx].status = status;
    goals[idx].updated_at = new Date().toISOString();
    ok = true;
    return goals;
  });
  console.log(ok ? `✅ 进度已更新: ${step}` : `❌ 目标不存在: ${goalId}`);
  return ok;
}

function addFailedAttempt(goalId, task, method, whyFailed, pivotTo) {
  let ok = false;
  update(FILE, (goals) => {
    const idx = goals.findIndex((g) => g.goal_id === goalId);
    if (idx === -1) return goals;
    goals[idx].failed_attempts.push({
      task,
      method,
      why_failed: whyFailed,
      pivot_to: pivotTo,
      timestamp: new Date().toISOString(),
    });
    goals[idx].updated_at = new Date().toISOString();
    ok = true;
    return goals;
  });
  console.log(ok ? '📝 失败记录已写入' : `❌ 目标不存在: ${goalId}`);
  return ok;
}

function getGoalStatus(goalId) {
  const goal = readJson(FILE).find((g) => g.goal_id === goalId);
  console.log(JSON.stringify(goal, null, 2));
  return goal;
}

function listUserGoals(userId) {
  const userGoals = readJson(FILE).filter((g) => g.user_id === userId);
  console.log(JSON.stringify(userGoals, null, 2));
  return userGoals;
}

function findActiveGoal(userId) {
  const active = readJson(FILE).find(
    (g) => g.user_id === userId && g.status === 'active'
  );
  console.log(active ? JSON.stringify(active, null, 2) : 'null');
  return active || null;
}

function decomposeGoal(goalId, decomposition) {
  let ok = false;
  update(FILE, (goals) => {
    const idx = goals.findIndex((g) => g.goal_id === goalId);
    if (idx === -1) return goals;
    goals[idx].decomposition = decomposition;
    goals[idx].updated_at = new Date().toISOString();
    ok = true;
    return goals;
  });
  console.log(
    ok ? `✅ 目标已分解为 ${decomposition.length} 个子任务` : `❌ 目标不存在: ${goalId}`
  );
  return ok;
}

const [, , command, ...args] = process.argv;

switch (command) {
  case 'create':
    createGoal(args[0], args[1]);
    break;
  case 'update':
    updateGoal(args[0], args[1], args[2]);
    break;
  case 'add-failed':
    addFailedAttempt(args[0], args[1], args[2], args[3], args[4]);
    break;
  case 'status':
    getGoalStatus(args[0]);
    break;
  case 'list':
    listUserGoals(args[0]);
    break;
  case 'active':
    findActiveGoal(args[0]);
    break;
  case 'decompose':
    try {
      decomposeGoal(args[0], JSON.parse(args.slice(1).join(' ')));
    } catch (e) {
      console.log('❌ 分解必须是有效的 JSON 数组');
    }
    break;
  default:
    console.log('Usage: goal-track <command> [args]');
    console.log('Commands: create, update, add-failed, status, list, active, decompose');
}
