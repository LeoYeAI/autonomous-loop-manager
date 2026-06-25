// store.js - 共享存储层：原子读写 + 简单文件锁
// v2: 支持 goals/ 目录结构 + ACTIVE_STATE.md

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory'
);

const GOALS_DIR = path.join(MEMORY_DIR, 'goals');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function goalDir(goalId) {
  const d = path.join(GOALS_DIR, goalId);
  ensureDir(d);
  ensureDir(path.join(d, 'evidence'));
  return d;
}

function filePath(name) {
  return path.join(MEMORY_DIR, name);
}

function goalFilePath(goalId, name) {
  return path.join(goalDir(goalId), name);
}

// 原子写：写临时文件 -> fsync -> rename
function atomicWrite(target, data) {
  ensureDir(path.dirname(target));
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, target);
}

// 简单目录锁（mkdir 原子）
function withLock(lockTarget, fn) {
  ensureDir(path.dirname(lockTarget));
  const lockPath = `${lockTarget}.lock`;
  const deadline = Date.now() + 5000;
  let locked = false;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath);
      locked = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > 10000) fs.rmdirSync(lockPath);
      } catch (_) {}
      const spin = Date.now() + 25;
      while (Date.now() < spin) {}
    }
  }
  try {
    return fn();
  } finally {
    if (locked) {
      try { fs.rmdirSync(lockPath); } catch (_) {}
    }
  }
}

function readJson(name, fallback = []) {
  const target = filePath(name);
  if (!fs.existsSync(target)) return fallback;
  try {
    const raw = fs.readFileSync(target, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function readJsonFile(target, fallback = []) {
  if (!fs.existsSync(target)) return fallback;
  try {
    const raw = fs.readFileSync(target, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(name, value) {
  atomicWrite(filePath(name), JSON.stringify(value, null, 2));
}

function writeJsonFile(target, value) {
  atomicWrite(target, JSON.stringify(value, null, 2));
}

// 读-改-写，全程持锁
function update(name, mutator, fallback = []) {
  const target = filePath(name);
  return withLock(target, () => {
    const current = readJson(name, fallback);
    const result = mutator(current);
    const next = result === undefined ? current : result;
    writeJson(name, next);
    return next;
  });
}

function updateFile(target, mutator, fallback = []) {
  return withLock(target, () => {
    const current = readJsonFile(target, fallback);
    const result = mutator(current);
    const next = result === undefined ? current : result;
    writeJsonFile(target, next);
    return next;
  });
}

// append-only jsonl（run-history）
function appendJsonl(target, record) {
  ensureDir(path.dirname(target));
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(target, line, 'utf-8');
}

function readJsonl(target) {
  if (!fs.existsSync(target)) return [];
  const lines = fs.readFileSync(target, 'utf-8').split('\n').filter(l => l.trim());
  return lines.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}

function genId(prefix = '') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 11);
  return prefix ? `${prefix}-${ts}-${rand}` : `${ts}-${rand}`;
}

module.exports = {
  MEMORY_DIR,
  GOALS_DIR,
  filePath,
  goalDir,
  goalFilePath,
  readJson,
  readJsonFile,
  writeJson,
  writeJsonFile,
  update,
  updateFile,
  withLock,
  atomicWrite,
  appendJsonl,
  readJsonl,
  genId,
};
