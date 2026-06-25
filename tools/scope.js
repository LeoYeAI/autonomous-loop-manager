#!/usr/bin/env node
// scope.js - 目标边界系统（allowed/forbidden/requires_gate）

const { goalFilePath, readJsonFile, writeJsonFile } = require('./lib/store');

function file(goalId) { return goalFilePath(goalId, 'scope.json'); }

function defaultScope(goalId) {
  return {
    goal_id: goalId,
    allowed: {
      filesystem: [],
      network: ['read_only'],
      tools: ['exec', 'read', 'write'],
      spend_limit_tokens_per_day: 100000,
    },
    forbidden: [
      'production 环境的任何写操作',
      '付费 API 调用（除非用户明确授权）',
      'git push to main',
    ],
    requires_gate: [
      '发布到公网',
      '修改数据库 schema',
      '调用第三方付费服务',
    ],
  };
}

function init(goalId) {
  const p = file(goalId);
  if (!readJsonFile(p, null)) {
    writeJsonFile(p, defaultScope(goalId));
  }
  console.log(JSON.stringify({ ok: true }, null, 2));
}

function get(goalId) {
  const s = readJsonFile(file(goalId), defaultScope(goalId));
  console.log(JSON.stringify(s, null, 2));
}

function set(goalId, scopeJson) {
  let scope;
  try { scope = JSON.parse(scopeJson); } catch (_) {
    console.log(JSON.stringify({ ok: false, error: 'invalid JSON' }));
    return;
  }
  scope.goal_id = goalId;
  writeJsonFile(file(goalId), scope);
  console.log(JSON.stringify({ ok: true }, null, 2));
}

// 检查一个动作是否在边界内
function check(goalId, action) {
  const scope = readJsonFile(file(goalId), defaultScope(goalId));
  const a = (action || '').toLowerCase();
  for (const f of scope.forbidden) {
    if (a.includes(f.toLowerCase().split('（')[0].trim().slice(0, 6))) {
      console.log(JSON.stringify({ allowed: false, reason: `禁止: ${f}` }, null, 2));
      return;
    }
  }
  for (const g of scope.requires_gate) {
    if (a.includes(g.toLowerCase().slice(0, 4))) {
      console.log(JSON.stringify({ allowed: false, requires_gate: true, reason: `需要用户授权: ${g}` }, null, 2));
      return;
    }
  }
  console.log(JSON.stringify({ allowed: true }, null, 2));
}

const [,, command, goalId, ...args] = process.argv;

switch (command) {
  case 'init': init(goalId); break;
  case 'get': get(goalId); break;
  case 'set': set(goalId, args.join(' ')); break;
  case 'check': check(goalId, args.join(' ')); break;
  default:
    console.log('Usage: scope.js <init|get|set|check> <goal_id> [args]');
}
