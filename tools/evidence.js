#!/usr/bin/env node
// evidence.js - 每轮执行的证据记录（append-only run-history.jsonl）

const { goalFilePath, appendJsonl, readJsonl, genId } = require('./lib/store');

function file(goalId) { return goalFilePath(goalId, 'run-history.jsonl'); }

function record(goalId, opts) {
  const runId = genId('run');
  const rec = {
    run_id: runId,
    goal_id: goalId,
    session_id: opts.session_id || 'unknown',
    started_at: opts.started_at || new Date().toISOString(),
    ended_at: new Date().toISOString(),
    classification: opts.classification || 'advancement',
    // advancement|blocker_writeback|gate_push|monitor_poll|no_progress|self_repair
    todos_completed: opts.todos_completed || [],
    todos_added: opts.todos_added || [],
    gates_opened: opts.gates_opened || [],
    validation_summary: opts.validation_summary || '',
    delivery_outcome: opts.delivery_outcome || 'outcome_progress',
    // outcome_progress|no_change|regression
    next_action: opts.next_action || '',
    token_estimate: opts.token_estimate ? Number(opts.token_estimate) : 0,
  };
  appendJsonl(file(goalId), rec);
  console.log(JSON.stringify({ ok: true, run_id: runId }, null, 2));
  return runId;
}

function list(goalId, limit = 10) {
  const all = readJsonl(file(goalId));
  console.log(JSON.stringify(all.slice(-limit), null, 2));
}

function stats(goalId, hours = 24) {
  const all = readJsonl(file(goalId));
  const since = Date.now() - hours * 3600 * 1000;
  const recent = all.filter(r => new Date(r.started_at).getTime() > since);
  const s = {
    window_hours: hours,
    runs_total: recent.length,
    runs_with_progress: recent.filter(r => r.delivery_outcome === 'outcome_progress').length,
    runs_no_progress: recent.filter(r => r.delivery_outcome === 'no_change').length,
    runs_regression: recent.filter(r => r.delivery_outcome === 'regression').length,
    todos_completed: recent.reduce((a, r) => a + (r.todos_completed || []).length, 0),
    todos_added: recent.reduce((a, r) => a + (r.todos_added || []).length, 0),
    gates_opened: recent.reduce((a, r) => a + (r.gates_opened || []).length, 0),
    token_estimate: recent.reduce((a, r) => a + (r.token_estimate || 0), 0),
  };
  console.log(JSON.stringify(s, null, 2));
  return s;
}

const [,, command, goalId, ...args] = process.argv;

function parseOpts(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    let val = args[i + 1];
    if (['todos_completed', 'todos_added', 'gates_opened'].includes(key)) {
      try { val = JSON.parse(val); } catch (_) { val = val ? val.split(',') : []; }
    }
    opts[key] = val;
  }
  return opts;
}

switch (command) {
  case 'record':
    record(goalId, parseOpts(args));
    break;
  case 'list':
    list(goalId, args[0] ? parseInt(args[0], 10) : 10);
    break;
  case 'stats':
    stats(goalId, args[0] ? parseInt(args[0], 10) : 24);
    break;
  default:
    console.log('Usage: evidence.js <record|list|stats> <goal_id> [args]');
    console.log('  record <goal_id> --classification advancement --delivery_outcome outcome_progress --validation_summary "..." --next_action "..." [--todos_completed id1,id2]');
}
