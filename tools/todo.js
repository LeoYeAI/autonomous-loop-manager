#!/usr/bin/env node
// todo.js - 带契约的工作单元（owner/precondition/success_criteria/scope）

const { goalFilePath, readJsonFile, updateFile, genId } = require('./lib/store');
const { renderActiveState } = require('./lib/state');

function file(goalId) { return goalFilePath(goalId, 'todos.json'); }

function addTodo(goalId, opts) {
  const todoId = genId('t');
  const now = new Date().toISOString();
  const todo = {
    todo_id: todoId,
    goal_id: goalId,
    title: opts.title || '',
    text: opts.text || opts.title || '',
    role: opts.role || 'agent',          // agent | user
    claimed_by: null,
    priority: opts.priority || 'P1',     // P0 | P1 | P2
    task_class: opts.task_class || 'advancement', // advancement|blocker|gate|monitor
    preconditions: opts.preconditions || [],
    success_criteria: opts.success_criteria || '',
    required_scope: opts.required_scope || [],
    status: 'open',                      // open|in_progress|done|blocked|deferred
    blocks_agent: opts.blocks_agent || false,
    created_at: now,
    updated_at: now,
    evidence: null,
  };
  updateFile(file(goalId), (todos) => { todos.push(todo); return todos; }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok: true, todo_id: todoId }, null, 2));
  return todoId;
}

function claim(goalId, todoId, claimedBy) {
  let ok = false;
  updateFile(file(goalId), (todos) => {
    const t = todos.find(x => x.todo_id === todoId);
    if (t && (!t.claimed_by || t.claimed_by === claimedBy) && t.status !== 'done') {
      t.claimed_by = claimedBy;
      t.status = 'in_progress';
      t.updated_at = new Date().toISOString();
      ok = true;
    }
    return todos;
  }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok, todo_id: todoId, claimed_by: claimedBy }, null, 2));
  return ok;
}

function complete(goalId, todoId, claimedBy, evidence) {
  let ok = false;
  updateFile(file(goalId), (todos) => {
    const t = todos.find(x => x.todo_id === todoId);
    if (t && t.status !== 'done') {
      t.status = 'done';
      t.evidence = evidence || '';
      t.updated_at = new Date().toISOString();
      ok = true;
    }
    return todos;
  }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok, todo_id: todoId }, null, 2));
  return ok;
}

function block(goalId, todoId, reason) {
  let ok = false;
  updateFile(file(goalId), (todos) => {
    const t = todos.find(x => x.todo_id === todoId);
    if (t) { t.status = 'blocked'; t.block_reason = reason; t.updated_at = new Date().toISOString(); ok = true; }
    return todos;
  }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok, todo_id: todoId }, null, 2));
  return ok;
}

// 列出可执行的 todo：open + 前置条件已满足 + 非 user role
function listActionable(goalId) {
  const todos = readJsonFile(file(goalId), []);
  const doneIds = new Set(todos.filter(t => t.status === 'done').map(t => t.todo_id));
  const actionable = todos.filter(t =>
    t.role === 'agent' &&
    (t.status === 'open' || t.status === 'in_progress') &&
    (t.preconditions || []).every(p => doneIds.has(p))
  ).sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });
  console.log(JSON.stringify(actionable, null, 2));
  return actionable;
}

function listAll(goalId) {
  console.log(JSON.stringify(readJsonFile(file(goalId), []), null, 2));
}

const [,, command, goalId, ...args] = process.argv;

function parseOpts(args) {
  // 解析 --key value 形式
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    let val = args[i + 1];
    if (['preconditions', 'required_scope'].includes(key)) {
      try { val = JSON.parse(val); } catch (_) { val = val ? val.split(',') : []; }
    }
    if (key === 'blocks_agent') val = val === 'true';
    opts[key] = val;
  }
  return opts;
}

switch (command) {
  case 'add':
    addTodo(goalId, parseOpts(args));
    break;
  case 'claim':
    claim(goalId, args[0], args[1]);
    break;
  case 'complete':
    complete(goalId, args[0], args[1], args.slice(2).join(' '));
    break;
  case 'block':
    block(goalId, args[0], args.slice(1).join(' '));
    break;
  case 'list-actionable':
    listActionable(goalId);
    break;
  case 'list':
    listAll(goalId);
    break;
  default:
    console.log('Usage: todo.js <add|claim|complete|block|list-actionable|list> <goal_id> [args]');
    console.log('  add <goal_id> --title "..." --priority P0 --task_class advancement --success_criteria "..." [--preconditions id1,id2] [--blocks_agent true]');
    console.log('  claim <goal_id> <todo_id> <claimed_by>');
    console.log('  complete <goal_id> <todo_id> <claimed_by> <evidence...>');
}
