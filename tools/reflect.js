#!/usr/bin/env node
// reflect.js - 自我反思工具（原子写 + 并发安全）

const { readJson, update, genId } = require('./lib/store');

const FILE = 'reflections.json';

function writeReflection(goalId, reflectionText, outcome, taskSummary) {
  const reflectionId = genId();
  update(FILE, (reflections) => {
    reflections.push({
      reflection_id: reflectionId,
      goal_id: goalId,
      task_summary: taskSummary,
      reflection: reflectionText,
      outcome,
      timestamp: new Date().toISOString(),
      tags: [],
      insights: [],
    });
    return reflections;
  });
  console.log(`✅ 反思已写入: ${reflectionId}`);
  return reflectionId;
}

function queryReflections(keyword, limit = 5) {
  const filtered = readJson(FILE)
    .filter(
      (r) => r.reflection.includes(keyword) || r.task_summary.includes(keyword)
    )
    .slice(0, limit);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function getGoalReflections(goalId) {
  const filtered = readJson(FILE).filter((r) => r.goal_id === goalId);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function extractInsights(reflectionId) {
  const reflection = readJson(FILE).find((r) => r.reflection_id === reflectionId);
  if (!reflection) {
    console.log(`❌ 反思不存在: ${reflectionId}`);
    return null;
  }
  console.log(
    JSON.stringify(
      {
        insights: [reflection.reflection, reflection.task_summary],
        outcome: reflection.outcome,
      },
      null,
      2
    )
  );
  return reflection;
}

function tagInsight(reflectionId, tag) {
  let ok = false;
  update(FILE, (reflections) => {
    const idx = reflections.findIndex((r) => r.reflection_id === reflectionId);
    if (idx === -1) return reflections;
    reflections[idx].tags.push(tag);
    ok = true;
    return reflections;
  });
  console.log(ok ? `🏷️ 洞察已标记: ${tag}` : `❌ 反思不存在: ${reflectionId}`);
  return ok;
}

function getFailedContexts() {
  const failed = readJson(FILE)
    .filter((r) => r.outcome === 'failed')
    .map((r) => ({ task: r.task_summary, reflection: r.reflection }));
  console.log(JSON.stringify(failed, null, 2));
  return failed;
}

const [, , command, ...args] = process.argv;

switch (command) {
  case 'write':
    writeReflection(args[0], args[1], args[2], args[3]);
    break;
  case 'query':
    queryReflections(args[0], args[1]);
    break;
  case 'goal':
    getGoalReflections(args[0]);
    break;
  case 'insights':
    extractInsights(args[0]);
    break;
  case 'tag':
    tagInsight(args[0], args[1]);
    break;
  case 'failed':
    getFailedContexts();
    break;
  default:
    console.log('Usage: reflect <command> [args]');
    console.log('Commands: write, query, goal, insights, tag, failed');
}
