#!/usr/bin/env node
/**
 * scrub-dream-noise.js
 * 从 daily log（memory/YYYY-MM-DD.md）删除 dreaming block 噪声。
 *
 * 背景：light/REM sleep 写回机制把 staged candidate（原始对话回放、
 * recalls:0、低 confidence）写进 daily log，造成 ~95% 噪声。
 * Dream 反复建议"从源头过滤"。本脚本删除被
 *   <!-- openclaw:dreaming:light:start --> ... :end -->
 *   <!-- openclaw:dreaming:rem:start --> ... :end -->
 * 包裹的区块，并删除其紧邻的 "## Light Sleep" / "## REM Sleep" 标题，
 * 只保留 Session Log 等真知识段落。
 *
 * 用法：
 *   node scrub-dream-noise.js <file.md> [--dry]   单文件
 *   node scrub-dream-noise.js --all [--dry]       memory/ 下全部 daily log
 * --dry 只报告不写入。会先写 .bak 备份。
 */
const fs = require('fs');
const path = require('path');

const MEM_DIR = path.resolve(__dirname, '..', '..', '..', 'memory');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const all = args.includes('--all');
const bare = args.includes('--bare-candidates');

function scrubText(text) {
  const lines = text.split('\n');
  const out = [];
  let skipping = false;
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 删除即将进入 dreaming block 的标题
    if (!skipping && /^##\s+(Light Sleep|REM Sleep)\s*$/.test(line)) {
      const next = lines[i + 1] || '';
      if (/<!--\s*openclaw:dreaming:(light|rem):start\s*-->/.test(next)) {
        removed++; // 标题
        continue;
      }
    }
    if (/<!--\s*openclaw:dreaming:(light|rem):start\s*-->/.test(line)) {
      skipping = true;
      removed++;
      continue;
    }
    if (skipping) {
      removed++;
      if (/<!--\s*openclaw:dreaming:(light|rem):end\s*-->/.test(line)) {
        skipping = false;
      }
      continue;
    }
    out.push(line);
  }
  // 第二趟：删除裸 candidate 块（无注释包裹的早期格式）
  // 形态：`- Candidate: ...` 后跟若干 `  - confidence/evidence/recalls/status` 行
  if (bare) {
    const o2 = [];
    for (let i = 0; i < out.length; i++) {
      if (/^-\s+Candidate:/.test(out[i])) {
        removed++;
        // 吞掉紧随的缩进元数据行
        let j = i + 1;
        while (j < out.length && /^\s+-\s+(confidence|evidence|recalls|status|note):/.test(out[j])) {
          removed++;
          j++;
        }
        i = j - 1;
        continue;
      }
      o2.push(out[i]);
    }
    out.length = 0;
    out.push(...o2);
  }
  // 折叠开头连续空行 / --- 分隔
  let cleaned = out.join('\n').replace(/^(\s*\n)+/, '').replace(/^(---\s*\n)+/, '');
  if (bare) {
    // 清理残留的孤儿元数据行、dreaming 标记、首部空行
    cleaned = cleaned
      .split('\n')
      .filter(l => !/^\s+-\s+(confidence|evidence|recalls|status|note):/.test(l))
      .filter(l => !/<!--\s*openclaw:dreaming:(light|rem):(start|end)\s*-->/.test(l))
      .join('\n')
      .replace(/^(\s*\n)+/, '');
  }
  return { cleaned, removed };
}

function processFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const before = text.split('\n').length;
  const { cleaned, removed } = scrubText(text);
  const after = cleaned.split('\n').length;
  if (removed === 0) {
    console.log(`  skip  ${path.basename(file)} (no dreaming block)`);
    return;
  }
  console.log(`  scrub ${path.basename(file)}: ${before} -> ${after} lines (-${removed})`);
  if (!dry) {
    fs.writeFileSync(file + '.bak', text);
    fs.writeFileSync(file, cleaned);
  }
}

let files = [];
if (all) {
  files = fs.readdirSync(MEM_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => path.join(MEM_DIR, f));
} else {
  const target = args.find(a => !a.startsWith('--'));
  if (!target) { console.error('need <file.md> or --all'); process.exit(1); }
  files = [path.resolve(target)];
}

console.log(`scrub-dream-noise${dry ? ' [DRY RUN]' : ''} — ${files.length} file(s)`);
files.forEach(processFile);
console.log('done.');
