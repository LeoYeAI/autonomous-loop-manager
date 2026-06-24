// store.js - 共享存储层：原子读写 + 简单文件锁
// 所有 memory 工具统一通过这里读写，避免多 session 并发写入丢数据。

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(
  process.env.HOME,
  '.openclaw/workspace/skills/autonomous-loop-manager/memory'
);

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function filePath(name) {
  return path.join(MEMORY_DIR, name);
}

// 原子写：写临时文件 -> fsync -> rename。rename 在同一文件系统上是原子操作。
function atomicWrite(name, data) {
  ensureDir();
  const target = filePath(name);
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

// 简单的目录锁（mkdir 是原子的）。拿不到锁就自旋等待，超时后强行继续以防死锁。
function withLock(name, fn) {
  ensureDir();
  const lockPath = filePath(`${name}.lock`);
  const deadline = Date.now() + 5000;
  let locked = false;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath);
      locked = true;
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // 清理超过 10s 的陈旧锁
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > 10000) fs.rmdirSync(lockPath);
      } catch (_) {}
      // 短暂忙等
      const spin = Date.now() + 25;
      while (Date.now() < spin) {}
    }
  }
  try {
    return fn();
  } finally {
    if (locked) {
      try {
        fs.rmdirSync(lockPath);
      } catch (_) {}
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

function writeJson(name, value) {
  atomicWrite(name, JSON.stringify(value, null, 2));
}

// 读-改-写一体，全程持锁，保证并发安全。
function update(name, mutator, fallback = []) {
  return withLock(name, () => {
    const current = readJson(name, fallback);
    const result = mutator(current);
    const next = result === undefined ? current : result;
    writeJson(name, next);
    return next;
  });
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

module.exports = {
  MEMORY_DIR,
  filePath,
  readJson,
  writeJson,
  update,
  withLock,
  atomicWrite,
  genId,
};
