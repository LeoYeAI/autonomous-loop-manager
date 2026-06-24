#!/usr/bin/env node
// recall.js - 按需加载层（清单注入 + 按需展开）
//
// 解决的问题：strategies/reflections/goals 全量注入 system prompt 会随记忆增长爆上下文。
// 方案：平时只注入"一行摘要清单"，Agent 判断相关后再用 expand 拉全文。
//
// 用法：
//   recall.js manifest <user_id> [--budget N]   只输出一行式清单（省 token）
//   recall.js expand strategy <id>              展开单条策略全文
//   recall.js expand reflection <id>            展开单条反思全文
//   recall.js expand goal <id>                  展开单个目标全文
//   recall.js search <keyword> [limit]          跨三类记忆的清单级搜索

const { readJson } = require('./lib/store');

function oneLine(s, n = 80) {
  const flat = String(s || '').replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

// 生成一行式清单：每条记忆只给 id + type + 一句话描述，绝不给全文。
function buildManifest(userId, budget) {
  const goals = readJson('goals.json').filter(
    (g) => !userId || g.user_id === userId
  );
  const strategies = readJson('strategies.json').filter(
    (s) => !userId || s.user_id === userId || s.user_id === 'default'
  );
  const reflections = readJson('reflections.json');

  const lines = [];

  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length) {
    lines.push('## 活跃目标');
    activeGoals.forEach((g) =>
      lines.push(
        `- [goal:${g.goal_id}] ${oneLine(g.goal_text)} (${g.completed_steps.length} 步完成)`
      )
    );
  }

  if (strategies.length) {
    lines.push('## 策略库（相关时 expand strategy <id>）');
    strategies
      .sort((a, b) => b.success_count - a.success_count)
      .forEach((s) =>
        lines.push(
          `- [strategy:${s.strategy_id}] ${oneLine(s.context)} (✓${s.success_count})`
        )
      );
  }

  if (reflections.length) {
    lines.push('## 反思（相关时 expand reflection <id>）');
    reflections
      .slice()
      .reverse()
      .forEach((r) =>
        lines.push(
          `- [reflection:${r.reflection_id}] ${oneLine(r.task_summary)} (${r.outcome})`
        )
      );
  }

  let out = lines.join('\n');

  // 可选 token 预算保护：粗略按 4 字符/token 估算，超了就截断并提示。
  if (budget && out.length > budget * 4) {
    out =
      out.slice(0, budget * 4) +
      '\n…（清单已按 token 预算截断，用 search 精确召回）';
  }
  return out;
}

function expand(type, id) {
  const map = {
    strategy: ['strategies.json', 'strategy_id'],
    reflection: ['reflections.json', 'reflection_id'],
    goal: ['goals.json', 'goal_id'],
  };
  const entry = map[type];
  if (!entry) {
    console.log(`❌ 未知类型: ${type}（可选 strategy|reflection|goal）`);
    return;
  }
  const [file, key] = entry;
  const item = readJson(file).find((x) => x[key] === id);
  if (!item) {
    console.log(`❌ 未找到 ${type}: ${id}`);
    return;
  }
  console.log(JSON.stringify(item, null, 2));
}

// 清单级搜索：返回命中条目的"一行摘要"，让 Agent 决定要不要 expand。
function search(keyword, limit = 8) {
  const hits = [];
  const k = String(keyword || '');

  readJson('goals.json').forEach((g) => {
    if (g.goal_text.includes(k))
      hits.push(`[goal:${g.goal_id}] ${oneLine(g.goal_text)}`);
  });
  readJson('strategies.json').forEach((s) => {
    if (s.context.includes(k) || s.strategy.includes(k))
      hits.push(`[strategy:${s.strategy_id}] ${oneLine(s.context)} (✓${s.success_count})`);
  });
  readJson('reflections.json').forEach((r) => {
    if (r.task_summary.includes(k) || r.reflection.includes(k))
      hits.push(`[reflection:${r.reflection_id}] ${oneLine(r.task_summary)} (${r.outcome})`);
  });

  const out = hits.slice(0, limit);
  console.log(out.length ? out.join('\n') : `（无命中: ${k}）`);
}

const [, , command, ...args] = process.argv;

switch (command) {
  case 'manifest': {
    let userId = args[0] && !args[0].startsWith('--') ? args[0] : null;
    const bIdx = args.indexOf('--budget');
    const budget = bIdx !== -1 ? parseInt(args[bIdx + 1], 10) : 0;
    console.log(buildManifest(userId, budget));
    break;
  }
  case 'expand':
    expand(args[0], args[1]);
    break;
  case 'search':
    search(args[0], args[1] ? parseInt(args[1], 10) : 8);
    break;
  default:
    console.log('Usage: recall <manifest|expand|search> [args]');
    console.log('  manifest <user_id> [--budget N]');
    console.log('  expand <strategy|reflection|goal> <id>');
    console.log('  search <keyword> [limit]');
}
