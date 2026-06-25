// state.js - ACTIVE_STATE.md 渲染（共享，避免 stale 状态）

const fs = require('fs');
const path = require('path');
const { readJsonFile, goalFilePath, atomicWrite } = require('./store');

const REGISTRY = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory/goals.json'
);

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8')); } catch (_) { return []; }
}

function renderActiveState(goalId) {
  const goal = readRegistry().find(g => g.goal_id === goalId);
  if (!goal) return '';
  const todos = readJsonFile(goalFilePath(goalId, 'todos.json'), []);
  const gates = readJsonFile(goalFilePath(goalId, 'gates.json'), []).filter(g => g.status === 'open');
  const scope = readJsonFile(goalFilePath(goalId, 'scope.json'), null);

  const openTodos = todos.filter(t => t.status !== 'done');
  const nextTodo = openTodos.find(t => t.role === 'agent') || null;

  const md = `# Goal: ${goal.goal_text}
**ID**: ${goal.goal_id}
**Status**: ${goal.status}
**Waiting On**: ${goal.waiting_on || 'agent'}
**Last Updated**: ${goal.updated_at}

## Objective
${goal.objective || goal.goal_text}

## Scope Boundary
${scope ? `- IN: ${(scope.allowed.filesystem || []).join(', ') || '(未限定)'}
- OUT: ${(scope.forbidden || []).slice(0, 3).join('; ')}` : '- (未配置 scope，运行 scope.js init)'}

## Current Focus
${goal.current_step || '(未设定)'}

## Next Action
${nextTodo ? `[${nextTodo.priority}] ${nextTodo.title} — ${nextTodo.success_criteria || ''}` : '(无待办，等待规划)'}

## Open User Gates (${gates.length})
${gates.length ? gates.map(g => `- ${g.question}${g.bypass_allowed ? ` (可旁路: ${g.bypass_scope})` : ''}`).join('\n') : '(无)'}

## Open Todos (${openTodos.length})
${openTodos.slice(0, 8).map(t => `- [${t.status}][${t.priority}] ${t.title}`).join('\n') || '(无)'}

## Critic
${goal.critic || '(无明显风险)'}
`;
  atomicWrite(goalFilePath(goalId, 'ACTIVE_STATE.md'), md);
  return md;
}

module.exports = { renderActiveState, readRegistry };
