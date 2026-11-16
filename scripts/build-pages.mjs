// 把 public/ 转成可在 GitHub Pages 子路径（/<repo>/）下运行的静态副本。
//
// 为什么需要：Pages 项目页地址是 /<repo>/，而源码里用的是根路径绝对引用
// （/style.css、/assets/...），在子路径下会落到根域导致 404。
// 这里只在**构建产物**里改成相对路径，main 分支源码保持原样，
// 因为 Render / 本地 `npm start` 走的是根路径，不该被牵连。
//
// 用法：node scripts/build-pages.mjs   输出目录：.pages-dist/

import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'public';
const OUT = '.pages-dist';

// 只匹配「引号内以 / 开头的资源路径」，避免误伤注释、正则和 //host 形式的 URL
const RULES = [
  [/(["'])\/assets\//g, '$1./assets/'],
  [/(["'])\/rag\//g, '$1./rag/'],
  [/(["'])\/partner\//g, '$1./partner/'],
];
const HTML_RULES = [[/\b(src|href)="\//g, '$1="./']];

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });

const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css']);
const stats = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!TEXT_EXT.has(extname(name).toLowerCase())) continue;

    const original = readFileSync(full, 'utf8');
    let text = original;
    let hits = 0;

    for (const [re, rep] of HTML_RULES) {
      hits += (text.match(re) || []).length;
      text = text.replace(re, rep);
    }
    for (const [re, rep] of RULES) {
      hits += (text.match(re) || []).length;
      text = text.replace(re, rep);
    }
    if (hits && text !== original) {
      writeFileSync(full, text);
      stats.push([name, hits]);
    }
  }
}

walk(OUT);

const total = stats.reduce((s, [, n]) => s + n, 0);
console.log(`[pages] 改写 ${total} 处绝对路径，涉及 ${stats.length} 个文件`);
for (const [name, n] of stats.sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${name}`);

// 残留检查：静态站上不该再出现资源级绝对路径（/api/ 保留，它本来就该 404）
const LEFT = /(["'])\/(assets|rag|partner)\//g;
const leftovers = [];
function verify(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { verify(full); continue; }
    if (!TEXT_EXT.has(extname(name).toLowerCase())) continue;
    const hits = (readFileSync(full, 'utf8').match(LEFT) || []).length;
    if (hits) leftovers.push(`${name}: ${hits}`);
  }
}
verify(OUT);

if (leftovers.length) {
  console.error(`[pages] 残留 ${leftovers.length} 处：${leftovers.join(', ')}`);
  process.exit(1);
}
console.log('[pages] 残留检查通过：0 处');
