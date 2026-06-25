#!/usr/bin/env node
// gate.js - 人类决策点队列（显式标记需要用户介入的点）

const { goalFilePath, readJsonFile, updateFile, genId } = require('./lib/store');
const { renderActiveState } = require('./lib/state');

function file(goalId) { return goalFilePath(goalId, 'gates.json'); }

function addGate(goalId, opts) {
  const gateId = genId('gate');
  const now = new Date().toISOString();
  const gate = {
    gate_id: gateId,
    goal_id: goalId,
    question: opts.question || '',
    context: opts.context || '',
    options: opts.options || [],
    blocking: opts.blocking !== false,
    bypass_allowed: opts.bypass_allowed || false,
    bypass_scope: opts.bypass_scope || null,
    status: 'open',                  // open|answered|bypassed
    created_at: now,
    answered_at: null,
    answer: null,
    notified: false,
  };
  updateFile(file(goalId), (gates) => { gates.push(gate); return gates; }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok: true, gate_id: gateId }, null, 2));
  return gateId;
}

function answer(goalId, gateId, answerText) {
  let ok = false;
  updateFile(file(goalId), (gates) => {
    const g = gates.find(x => x.gate_id === gateId);
    if (g && g.status === 'open') {
      g.status = 'answered';
      g.answer = answerText;
      g.answered_at = new Date().toISOString();
      ok = true;
    }
    return gates;
  }, []);
  renderActiveState(goalId);
  console.log(JSON.stringify({ ok, gate_id: gateId }, null, 2));
  return ok;
}

function markNotified(goalId, gateId) {
  updateFile(file(goalId), (gates) => {
    const g = gates.find(x => x.gate_id === gateId);
    if (g) g.notified = true;
    return gates;
  }, []);
  console.log(JSON.stringify({ ok: true }, null, 2));
}

function listOpen(goalId) {
  const gates = readJsonFile(file(goalId), []).filter(g => g.status === 'open');
  console.log(JSON.stringify(gates, null, 2));
  return gates;
}

function listAll(goalId) {
  console.log(JSON.stringify(readJsonFile(file(goalId), []), null, 2));
}

const [,, command, goalId, ...args] = process.argv;

function parseOpts(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    let val = args[i + 1];
    if (key === 'options') { try { val = JSON.parse(val); } catch (_) { val = val ? val.split('|') : []; } }
    if (['blocking', 'bypass_allowed'].includes(key)) val = val === 'true';
    opts[key] = val;
  }
  return opts;
}

switch (command) {
  case 'add':
    addGate(goalId, parseOpts(args));
    break;
  case 'answer':
    answer(goalId, args[0], args.slice(1).join(' '));
    break;
  case 'notified':
    markNotified(goalId, args[0]);
    break;
  case 'list-open':
    listOpen(goalId);
    break;
  case 'list':
    listAll(goalId);
    break;
  default:
    console.log('Usage: gate.js <add|answer|notified|list-open|list> <goal_id> [args]');
    console.log('  add <goal_id> --question "..." --context "..." [--options "a|b|c"] [--bypass_allowed true --bypass_scope "..."]');
    console.log('  answer <goal_id> <gate_id> <answer...>');
}
