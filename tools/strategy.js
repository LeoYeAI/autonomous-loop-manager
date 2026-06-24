#!/usr/bin/env node
// strategy.js - 策略库管理（原子写 + 并发安全）

const { readJson, update, genId } = require('./lib/store');

const FILE = 'strategies.json';

function addStrategy(context, strategy, userId = 'default') {
  const strategyId = genId();
  const timestamp = new Date().toISOString();
  update(FILE, (strategies) => {
    strategies.push({
      strategy_id: strategyId,
      user_id: userId,
      context,
      strategy,
      success_count: 1,
      last_used: timestamp,
      created_at: timestamp,
    });
    return strategies;
  });
  console.log(`✅ 策略已添加: ${strategyId}`);
  return strategyId;
}

function queryStrategy(context, limit = 3) {
  const filtered = readJson(FILE)
    .filter((s) => s.context.includes(context) || context.includes(s.context))
    .sort((a, b) => b.success_count - a.success_count)
    .slice(0, limit);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function incrementSuccess(strategyId) {
  let ok = false;
  update(FILE, (strategies) => {
    const idx = strategies.findIndex((s) => s.strategy_id === strategyId);
    if (idx === -1) return strategies;
    strategies[idx].success_count += 1;
    strategies[idx].last_used = new Date().toISOString();
    ok = true;
    return strategies;
  });
  console.log(ok ? '📈 成功计数 +1' : `❌ 策略不存在: ${strategyId}`);
  return ok;
}

function updateStrategy(strategyId, newStrategy) {
  let ok = false;
  update(FILE, (strategies) => {
    const idx = strategies.findIndex((s) => s.strategy_id === strategyId);
    if (idx === -1) return strategies;
    strategies[idx].strategy = newStrategy;
    ok = true;
    return strategies;
  });
  console.log(ok ? '✅ 策略已更新' : `❌ 策略不存在: ${strategyId}`);
  return ok;
}

function getTopStrategies(userId, limit = 5) {
  const filtered = readJson(FILE)
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.success_count - a.success_count)
    .slice(0, limit);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function getRecentStrategies(userId, limit = 5) {
  const filtered = readJson(FILE)
    .filter((s) => s.user_id === userId)
    .sort((a, b) => new Date(b.last_used) - new Date(a.last_used))
    .slice(0, limit);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function searchStrategies(keywords, limit = 5) {
  const filtered = readJson(FILE)
    .filter((s) => s.context.includes(keywords) || s.strategy.includes(keywords))
    .slice(0, limit);
  console.log(JSON.stringify(filtered, null, 2));
  return filtered;
}

function deleteStrategy(strategyId) {
  update(FILE, (strategies) =>
    strategies.filter((s) => s.strategy_id !== strategyId)
  );
  console.log('🗑️ 策略已删除');
  return true;
}

const [, , command, ...args] = process.argv;

switch (command) {
  case 'add':
    addStrategy(args[0], args[1], args[2]);
    break;
  case 'query':
    queryStrategy(args[0], args[1]);
    break;
  case 'success':
    incrementSuccess(args[0]);
    break;
  case 'update':
    updateStrategy(args[0], args[1]);
    break;
  case 'top':
    getTopStrategies(args[0], args[1]);
    break;
  case 'recent':
    getRecentStrategies(args[0], args[1]);
    break;
  case 'search':
    searchStrategies(args[0], args[1]);
    break;
  case 'delete':
    deleteStrategy(args[0]);
    break;
  default:
    console.log('Usage: strategy <command> [args]');
    console.log('Commands: add, query, success, update, top, recent, search, delete');
}
