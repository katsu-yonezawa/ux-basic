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
const syllabusPath = path.join(DOCS, 'syllabus_keywords.json');
const syllabusKeywords = fs.existsSync(syllabusPath)
  ? JSON.parse(fs.readFileSync(syllabusPath, 'utf8'))
  : [];
const LABELS = ['A', 'B', 'C', 'D'];

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

function inferChapterNum(category) {
  const c = String(category || '');
  const rules = [
    [1, /UXとは|UXが重視|UXデザイン|UXグロース|UXインテリジェンス/],
    [2, /人間中心デザイン|HCD|デザイン思考|アジャイル|リーン|パーパス|行動経済学|認知心理学|文化人類学|人間工学|ユーザビリティ|アクセシビリティ/],
    [3, /プロジェクトマネジメント|プロダクトマネジメント/],
    [4, /UXリサーチ|定量調査|定性調査|行動データ分析/],
    [5, /ユーザーモデリング|理想の利用状況|アイデア創出|ユーザー要求/],
    [6, /情報設計|プロトタイピング|UXライティング/],
    [7, /ユーザーテスト|エキスパートレビュー|UXデザイン評価/],
    [8, /継続的なUX改善|UX運用|DesignOps|DevOps/],
    [9, /組織開発|育成|UX組織化/]
  ];
  const hit = rules.find(([, re]) => re.test(c));
  return hit ? hit[0] : null;
}

function countAnswers(list) {
  return list.reduce((acc, q) => {
    acc[q.answer] = (acc[q.answer] || 0) + 1;
    return acc;
  }, { A: 0, B: 0, C: 0, D: 0 });
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
          parsed.chapterNum = cm.num;
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
    parsed.chapterNum = inferChapterNum(qm.category);
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
    '実務例': 'practice', '試験での注意点': 'note',
    '重要度': 'priority', 'カテゴリ': 'category'
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
    generatedAt: new Date().toISOString(),
    officialInfoCheckedAt: (guide.match(/確認日[:：]\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null,
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
  syllabusKeywords,
  syllabus,
  reviewMemo,
  plan2,
  plan4
};

// 検証ログ
const warnings = [];
const errors = [];
function warn(cond, msg) { if (!cond) warnings.push(msg); }
function fail(cond, msg) { if (!cond) errors.push(msg); }

function validateSyllabus() {
  const seen = new Map();
  syllabusKeywords.forEach((group, i) => {
    fail(group.category, `syllabus[${i}]: category がありません`);
    fail(group.subcategory, `syllabus[${i}]: subcategory がありません`);
    fail(['A', 'B', 'C'].includes(group.priority), `syllabus[${i}]: priority が A/B/C ではありません`);
    fail(Array.isArray(group.keywords) && group.keywords.length, `syllabus[${i}]: keywords がありません`);
    (group.keywords || []).forEach(keyword => {
      const key = String(keyword).trim();
      if (!key) return;
      if (seen.has(key)) warn(false, `シラバス語句 "${key}" が重複しています（${seen.get(key)} / ${group.category}）`);
      else seen.set(key, group.category);
    });
  });

  const fullCorpus = [
    guide,
    glossaryMd,
    ...mockQuestions.map(q => `${q.q}\n${Object.values(q.options).join('\n')}\n${q.explain}\n${Object.values(q.wrong || {}).join('\n')}`),
    ...chapters.flatMap(c => c.miniQuiz.map(q => `${q.q}\n${Object.values(q.options).join('\n')}\n${q.explain}\n${Object.values(q.wrong || {}).join('\n')}`))
  ].join('\n');
  const bodyCorpus = [guide, glossaryMd].join('\n');
  let missingA = 0;
  syllabusKeywords.forEach(group => {
    (group.keywords || []).forEach(keyword => {
      if (group.priority === 'A' && !fullCorpus.includes(keyword)) {
        missingA++;
        fail(false, `A優先シラバス語句 "${keyword}" が本文・用語集・問題に見つかりません`);
      } else if (group.priority === 'B' && !bodyCorpus.includes(keyword)) {
        warn(false, `B優先シラバス語句 "${keyword}" が本文または用語集に見つかりません`);
      }
    });
  });
  return { missingA };
}

function validateQuestions(list, label) {
  const ids = new Set();
  const texts = new Map();
  list.forEach(q => {
    const prefix = `${label}:${q.id}`;
    fail(q.id && !ids.has(q.id), `${prefix}: id が空、または重複しています`);
    ids.add(q.id);
    fail(q.q && q.q.trim(), `${prefix}: 問題文が空です`);
    fail(Object.keys(q.options || {}).length === 4, `${prefix}: 選択肢が4つではありません`);
    fail(LABELS.includes(q.answer), `${prefix}: answer が A/B/C/D ではありません`);
    fail(q.options && q.options[q.answer], `${prefix}: answer が options に存在しません`);
    fail(q.explain && q.explain.trim(), `${prefix}: 解説が空です`);
    const wrongKeys = Object.keys(q.wrong || {}).sort();
    const expectedWrong = LABELS.filter(k => k !== q.answer).sort();
    fail(wrongKeys.length === 3 && wrongKeys.join(',') === expectedWrong.join(','),
      `${prefix}: 不正解選択肢の理由が正解以外3つ分ではありません`);
    fail(q.category && q.category.trim(), `${prefix}: category が空です`);
    fail(Number.isInteger(q.chapterNum) && q.chapterNum >= 1 && q.chapterNum <= 9, `${prefix}: chapterNum を付与できません`);
    const normalizedText = (q.q || '').replace(/\s+/g, ' ').trim();
    if (normalizedText) {
      if (texts.has(normalizedText)) fail(false, `${prefix}: 問題文が ${texts.get(normalizedText)} と重複しています`);
      else texts.set(normalizedText, prefix);
    }
  });
}

function validateDistribution(list, label, minRatio, maxRatio) {
  const dist = countAnswers(list);
  const total = list.length || 1;
  LABELS.forEach(k => {
    const ratio = dist[k] / total;
    fail(ratio >= minRatio && ratio <= maxRatio,
      `${label}: 正解${k}の比率が許容範囲外です（${dist[k]}/${total}）`);
  });
  return dist;
}

function validateWeakDistractors() {
  const weakWords = ['CPU', '席順', '会議室予約だけ', '予算表だけ', 'データベースだけ', 'ファイル名だけ', '派手'];
  const allQuestions = [
    ...mockQuestions.map(q => ({ label: `mock:${q.id}`, q })),
    ...chapters.flatMap(c => c.miniQuiz.map(q => ({ label: `mini:${q.id}`, q })))
  ];
  weakWords.forEach(word => {
    const hits = allQuestions
      .filter(({ q }) => Object.values(q.options || {}).some(text => String(text).includes(word)))
      .map(({ label }) => label);
    if (hits.length) warn(false, `弱い誤答語 "${word}" が ${hits.length}件あります: ${hits.join(', ')}`);
  });
}

function validateAll() {
  const requiredSections = ['understand', 'concept', 'related', 'practice', 'pitfalls', 'memo'];
  fail(chapters.length === 9, `章数が9ではありません（${chapters.length}）`);
  chapters.forEach(c => {
    requiredSections.forEach(key => fail(c.sections[key], `第${c.num}章に ${key} セクションがありません`));
    fail(c.miniQuiz.length === 5, `第${c.num}章のミニ問題が ${c.miniQuiz.length} 問です`);
  });
  fail(mockQuestions.length === 100, `模擬問題が100問ではありません（${mockQuestions.length}）`);
  fail(glossary.length >= 110, `用語集が110語未満です（${glossary.length}語）`);
  glossary.forEach(g => {
    fail(g.term, '用語名が空の用語があります');
    fail(g.def, `語句 "${g.term}" に一言定義がありません`);
    if (g.priority === 'A') fail(g.note, `A重要語句 "${g.term}" に試験での注意点がありません`);
  });
  validateQuestions(mockQuestions, 'mock');
  validateQuestions(chapters.flatMap(c => c.miniQuiz), 'mini');
  const mockDist = validateDistribution(mockQuestions, '模擬問題', 0.15, 0.35);
  const miniDist = validateDistribution(chapters.flatMap(c => c.miniQuiz), '章末問題', 0.10, 0.40);
  validateWeakDistractors();
  const syllabusReport = validateSyllabus();
  return { mockDist, miniDist, syllabusReport };
}

const report = validateAll();

console.log('章:', chapters.length);
console.log('語句:', glossary.length);
console.log('模擬問題:', mockQuestions.length);
console.log('章末問題:', data.meta.counts.mini);
console.log('模擬問題 正解分布:', report.mockDist);
console.log('章末問題 正解分布:', report.miniDist);
console.log('シラバスA語句 未対応:', report.syllabusReport.missingA);
console.log('warnings:', warnings.length);
warnings.forEach(msg => console.warn('  ! ' + msg));
console.log('errors:', errors.length);
errors.forEach(msg => console.error('  x ' + msg));
if (errors.length) process.exitCode = 1;

const out = '/* 自動生成ファイル — `node site/build.js` で再生成。直接編集しないでください。 */\n'
  + 'window.UXDATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(__dirname, 'js', 'data.js'), out);
console.log('\n=> site/js/data.js を書き出しました (' + (out.length / 1024).toFixed(1) + ' KB)');
