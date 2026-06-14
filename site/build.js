#!/usr/bin/env node
/*
 * build.js — docs/*.md を構造化データ (site/js/data.js) に変換する。
 * docs を更新したら `node site/build.js` を再実行すれば学習サイトに反映される。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const guide = fs.readFileSync(path.join(DOCS, 'ux_kentei_basic_hcd_study_guide.md'), 'utf8');
const glossaryMd = fs.readFileSync(path.join(DOCS, 'ux_kentei_basic_glossary.md'), 'utf8');

/* ---------- 共通ヘルパ ---------- */

// 1問分の行配列から設問オブジェクトを作る
function parseQuizBlock(blockLines) {
  const q = { q: '', options: {}, answer: '', explain: '', wrong: {} };
  let mode = null; // 'wrong' = 不正解選択肢の理由ブロック中
  for (const raw of blockLines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^\*\*Q\d+[.．]\s*(.+?)\*\*$/))) { q.q = m[1].trim(); continue; }
    if ((m = line.match(/^正解[:：]\s*\*\*?([ABCD])\*?\*?/))) { q.answer = m[1]; mode = null; continue; }
    if ((m = line.match(/^解説[:：]\s*(.+)$/))) { q.explain = m[1].trim(); mode = null; continue; }
    if (/^不正解選択肢の理由[:：]/.test(line)) { mode = 'wrong'; continue; }
    if (mode === 'wrong' && (m = line.match(/^[-*]\s*([ABCD])[:：]\s*(.+)$/))) { q.wrong[m[1]] = m[2].trim(); continue; }
    if ((m = line.match(/^([ABCD])[.．]\s+(.+)$/))) { q.options[m[1]] = m[2].trim(); continue; }
    // 設問本文（模擬問題はオプション前の最初の行）
    if (!q.q && mode === null) { q.q = line; continue; }
    // 設問本文の続き（複数行）
    if (q.q && Object.keys(q.options).length === 0 && mode === null && !/^正解/.test(line)) {
      q.q += line;
    }
  }
  return q;
}

const lines = guide.split('\n');

// レベル1見出しの位置を収集
const h1 = [];
lines.forEach((l, i) => { const m = l.match(/^# (.+?)\s*$/); if (m) h1.push({ i, title: m[1].trim() }); });

function sectionByPredicate(pred) {
  for (let k = 0; k < h1.length; k++) {
    if (pred(h1[k].title)) {
      const start = h1[k].i + 1;
      const end = k + 1 < h1.length ? h1[k + 1].i : lines.length;
      return lines.slice(start, end);
    }
  }
  return [];
}

function trimBlank(arr) {
  let s = 0, e = arr.length;
  while (s < e && arr[s].trim() === '') s++;
  while (e > s && arr[e - 1].trim() === '') e--;
  return arr.slice(s, e);
}

/* ---------- 章の解析 ---------- */

const SECTION_KEY = {
  '1': 'understand', '2': 'concept', '3': 'related',
  '4': 'practice', '5': 'pitfalls', '6': 'miniQuiz', '7': 'memo'
};

const bodyLines = sectionByPredicate(t => /^3\./.test(t)); // 本編テキスト
const chapters = [];
{
  // 章見出しの位置
  const chMarks = [];
  bodyLines.forEach((l, i) => {
    const m = l.match(/^## 第(\d+)章\s+(.+?)\s*$/);
    if (m) chMarks.push({ i, num: Number(m[1]), title: m[2].trim() });
  });
  chMarks.forEach((cm, idx) => {
    const start = cm.i + 1;
    const end = idx + 1 < chMarks.length ? chMarks[idx + 1].i : bodyLines.length;
    const chLines = bodyLines.slice(start, end);
    // セクション(### N.)で分割
    const secMarks = [];
    chLines.forEach((l, i) => {
      const m = l.match(/^### (\d+)\.\s+(.+?)\s*$/);
      if (m) secMarks.push({ i, num: m[1], name: m[2].trim() });
    });
    const sections = {};
    let miniQuiz = [];
    secMarks.forEach((sm, j) => {
      const s = sm.i + 1;
      const e = j + 1 < secMarks.length ? secMarks[j + 1].i : chLines.length;
      const secLines = trimBlank(chLines.slice(s, e));
      const key = SECTION_KEY[sm.num];
      if (key === 'miniQuiz') {
        // **Q...** ごとに分割
        const qMarks = [];
        secLines.forEach((l, i) => { if (/^\s*\*\*Q\d+/.test(l)) qMarks.push(i); });
        qMarks.forEach((qi, qk) => {
          const qe = qk + 1 < qMarks.length ? qMarks[qk + 1] : secLines.length;
          const block = secLines.slice(qi, qe);
          const parsed = parseQuizBlock(block);
          parsed.id = `ch${cm.num}-q${qk + 1}`;
          parsed.category = `第${cm.num}章 ${cm.title}`;
          miniQuiz.push(parsed);
        });
      } else if (key) {
        sections[key] = trimBlank(secLines).join('\n');
      }
    });
    chapters.push({ num: cm.num, title: cm.title, sections, miniQuiz });
  });
}

/* ---------- 模擬問題100問 ---------- */

const mockLines = sectionByPredicate(t => /^7\./.test(t));
const mockQuestions = [];
{
  const qMarks = [];
  mockLines.forEach((l, i) => {
    const m = l.match(/^## 問(\d+)[　\s]+\[(.+?)\]/);
    if (m) qMarks.push({ i, id: m[1], category: m[2].trim() });
  });
  qMarks.forEach((qm, idx) => {
    const s = qm.i + 1;
    const e = idx + 1 < qMarks.length ? qMarks[idx + 1].i : mockLines.length;
    const block = mockLines.slice(s, e);
    const parsed = parseQuizBlock(block);
    parsed.id = qm.id;
    parsed.category = qm.category;
    mockQuestions.push(parsed);
  });
}

/* ---------- 重要語句集 ---------- */

const glossary = [];
{
  const glines = glossaryMd.split('\n');
  const FIELD = {
    '用語': 'term', '一言定義': 'def', '詳しい説明': 'desc',
    '関連語': 'related', '混同しやすい語': 'confusing',
    '実務例': 'practice', '試験での注意点': 'note'
  };
  let cur = null;
  for (const raw of glines) {
    const hm = raw.match(/^## (.+?)\s*$/);
    if (hm) { cur = { term: hm[1].trim() }; glossary.push(cur); continue; }
    if (!cur) continue;
    const fm = raw.match(/^\s*-\s*([^:：]+?)[:：]\s*(.+)$/);
    if (fm) {
      const key = FIELD[fm[1].trim()];
      if (key) cur[key] = fm[2].trim();
    }
  }
}

/* ---------- その他の章（生Markdownのまま保持） ---------- */

const examOverview = trimBlank(sectionByPredicate(t => /^2\./.test(t))).join('\n');
const readme = trimBlank(sectionByPredicate(t => /^1\./.test(t))).join('\n');
const syllabus = trimBlank(sectionByPredicate(t => /^5\./.test(t))).join('\n');
const reviewMemo = trimBlank(sectionByPredicate(t => /^8\./.test(t))).join('\n');
const plan2 = trimBlank(sectionByPredicate(t => /^9\./.test(t))).join('\n');
const plan4 = trimBlank(sectionByPredicate(t => /^10\./.test(t))).join('\n');

/* ---------- 出力 ---------- */

const data = {
  meta: {
    title: 'UX検定基礎 学習サイト',
    source: 'docs/ux_kentei_basic_hcd_study_guide.md, docs/ux_kentei_basic_glossary.md',
    builtFrom: 'UX検定基礎（HCD検®認定）試験対策教材',
    counts: {
      chapters: chapters.length,
      glossary: glossary.length,
      mock: mockQuestions.length,
      mini: chapters.reduce((a, c) => a + c.miniQuiz.length, 0)
    }
  },
  readme,
  examOverview,
  chapters,
  glossary,
  mockQuestions,
  syllabus,
  reviewMemo,
  plan2,
  plan4
};

// 検証ログ
function warn(cond, msg) { if (!cond) console.warn('  ! ' + msg); }
console.log('章:', chapters.length);
chapters.forEach(c => {
  warn(c.miniQuiz.length === 5, `第${c.num}章のミニ問題が ${c.miniQuiz.length} 問`);
  c.miniQuiz.forEach(q => {
    warn(Object.keys(q.options).length === 4 && q.answer, `第${c.num}章 ${q.id}: opts=${Object.keys(q.options).length} ans=${q.answer}`);
  });
});
console.log('語句:', glossary.length);
glossary.forEach(g => warn(g.def, `語句 "${g.term}" に一言定義なし`));
console.log('模擬問題:', mockQuestions.length);
mockQuestions.forEach(q => warn(Object.keys(q.options).length === 4 && q.answer && q.q, `問${q.id}: opts=${Object.keys(q.options).length} ans=${q.answer} q=${!!q.q}`));

const out = '/* 自動生成ファイル — `node site/build.js` で再生成。直接編集しないでください。 */\n'
  + 'window.UXDATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(__dirname, 'js', 'data.js'), out);
console.log('\n=> site/js/data.js を書き出しました (' + (out.length / 1024).toFixed(1) + ' KB)');
