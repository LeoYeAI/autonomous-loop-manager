#!/usr/bin/env node
// plan.js - 从 memory 生成执行计划
// 综合"活跃目标 + 相关策略 + 历史失败"，生成有记忆的计划。

const { readJson } = require('./lib/store');

function findRelevantStrategies(task) {
  return readJson('strategies.json')
    .filter((s) => task.includes(s.context) || s.context.includes(task.split(' ')[0]))
    .sort((a, b) => b.success_count - a.success_count)
    .slice(0, 3);
}

function findFailedAttempts(task) {
  return readJson('reflections.json')
    .filter(
      (r) =>
        r.outcome === 'failed' &&
        (task.includes(r.task_summary) || r.task_summary.includes(task.split(' ')[0]))
    )
    .slice(0, 3);
}

function findActiveGoal(userId) {
  return readJson('goals.json').find(
    (g) => g.user_id === userId && g.status === 'active'
  );
}

function generatePlan(taskDescription, userId) {
  const plan = {
    timestamp: new Date().toISOString(),
    task: taskDescription,
    relevant_strategies: findRelevantStrategies(taskDescription),
    avoid_these_failures: findFailedAttempts(taskDescription),
    active_goal: findActiveGoal(userId),
    recommendations: [],
  };

  if (plan.active_goal) {
    plan.recommendations.push({
      type: 'continue',
      message: `检测到您有一个进行中的目标: "${plan.active_goal.goal_text}"`,
    });
  }
  if (plan.relevant_strategies.length > 0) {
    plan.recommendations.push({
      type: 'strategy',
      message: `之前类似任务用过这些方法: ${plan.relevant_strategies
        .map((s) => s.context)
        .join(', ')}`,
    });
  }
  if (plan.avoid_these_failures.length > 0) {
    plan.recommendations.push({
      type: 'warning',
      message: `注意：之前类似任务失败过，原因: ${plan.avoid_these_failures[0].reflection.slice(
        0,
        100
      )}`,
    });
  }

  return plan;
}

// 解析参数：从任务描述里提取可选的 user_id。
// 用 let 声明，避免对常量再赋值（旧版本此处会抛 "Assignment to constant variable"）。
let taskDescription = process.argv.slice(2).join(' ');
let userId = 'default';

const userIdMatch = taskDescription.match(/user[_-]?id[:\s]+(\w+)/i);
if (userIdMatch) {
  userId = userIdMatch[1];
  taskDescription = taskDescription.replace(/user[_-]?id[:\s]+(\w+)/i, '').trim();
}

if (!taskDescription) {
  console.log('Usage: plan <任务描述> [user_id: <id>]');
  console.log('从 memory 中查找相关策略和失败教训，生成执行计划');
} else {
  console.log(JSON.stringify(generatePlan(taskDescription, userId), null, 2));
}
