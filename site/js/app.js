/* ============================================================
   UX検定基礎 学習サイト — アプリ本体（依存なしのバニラJS / SPA）
   data.js が定義する window.UXDATA を読み込んで動作します。
   ============================================================ */
(function () {
  'use strict';
  const DATA = window.UXDATA;
  const main = document.getElementById('main');

  /* ---------- 保存（localStorage） ---------- */
  const SKEY = 'uxkentei.v1';
  let STORE = {};
  try { STORE = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { STORE = {}; }
  STORE.read = STORE.read || {};
  STORE.cards = STORE.cards || {};
  STORE.quiz = STORE.quiz || {};
  STORE.quiz.stats = STORE.quiz.stats || {};
  STORE.quiz.history = STORE.quiz.history || [];
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(STORE)); } catch (e) {} }

  /* ---------- 全設問プール（模試 + ミニ問題を統合） ---------- */
  const ALL_Q = [];
  function normQ(kind, q) {
    return { key: kind + ':' + q.id, kind, id: q.id, q: q.q, options: q.options,
      answer: q.answer, explain: q.explain, wrong: q.wrong || {}, category: q.category };
  }
  DATA.mockQuestions.forEach(q => ALL_Q.push(normQ('mock', q)));
  DATA.chapters.forEach(c => c.miniQuiz.forEach(q => ALL_Q.push(normQ('mini', q))));

  /* ---------- 試験メタ（docs/examOverview より） ---------- */
  const EXAM_DATE = new Date('2026-07-11T13:00:00+09:00');
  const EXAM_FACTS = [
    ['試験日', '2026年7月11日(土) 13:00 一斉開始'],
    ['出題形式', '知識問題（単一選択式）100問'],
    ['試験時間', '100分'],
    ['受験方式', 'オンライン（自宅受験）'],
    ['申込期間', '2026年3月16日〜6月23日'],
    ['受験料', '9,900円（税抜）/ 10,890円（税込）'],
    ['合格基準', '公式に非公表（本サイトでは断定しません）']
  ];

  /* ============================================================
     ユーティリティ
     ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  let toastTimer = null;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
  }

  /* ---------- 簡易Markdownレンダラ（見出し/段落/箇条書き/表/強調/リンク） ---------- */
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }
  function renderTable(rowsRaw) {
    const rows = rowsRaw.map(r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
    const header = rows[0], body = rows.slice(2);
    let h = '<table class="prose-table"><thead><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
    body.forEach(r => { h += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'; });
    return h + '</tbody></table>';
  }
  function md(text) {
    if (!text) return '';
    const lines = text.split('\n'); let html = ''; let i = 0;
    const isSep = l => /^[\s|:\-]+$/.test(l) && l.indexOf('-') >= 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        const tbl = []; while (i < lines.length && /^\s*\|/.test(lines[i])) { tbl.push(lines[i]); i++; }
        html += renderTable(tbl); continue;
      }
      const hm = line.match(/^(#{1,6})\s+(.+)$/);
      if (hm) { const lvl = hm[1].length; html += `<h${lvl}>${inline(hm[2])}</h${lvl}>`; i++; continue; }
      if (/^\s*[-*]\s+/.test(line)) {
        html += '<ul>';
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`; i++; }
        html += '</ul>'; continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        html += '<ol>';
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`; i++; }
        html += '</ol>'; continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^\s*\|/.test(lines[i]) &&
             !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
        para.push(lines[i].trim()); i++;
      }
      html += `<p>${inline(para.join(''))}</p>`;
    }
    return html;
  }

  /* ============================================================
     画面遷移
     ============================================================ */
  let TIMER = null; // 実行中のクイズタイマー
  function setView(html, onMount, opts) {
    if (TIMER) { clearInterval(TIMER); TIMER = null; }
    main.innerHTML = html;
    updateNav();
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
    if (onMount) onMount();
    closeMenu();
  }
  function updateNav() {
    const seg = (location.hash.split('/')[1] || '').split('?')[0];
    const map = { '': 'home', read: 'read', cards: 'cards', glossary: 'cards', quiz: 'quiz', search: 'search', plan: 'plan' };
    const active = map[seg] || 'home';
    document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === active));
  }

  function render() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\//, '').split('/');
    const route = parts[0] || '';
    if (route === '') return viewHome();
    if (route === 'read') return parts[1] ? viewChapter(Number(parts[1])) : viewReadList();
    if (route === 'cards') return viewCards();
    if (route === 'glossary') return viewGlossaryTable();
    if (route === 'quiz') {
      if (parts[1] === 'run') return viewQuizRun();
      if (parts[1] === 'result') return viewQuizResult();
      return viewQuizMenu();
    }
    if (route === 'search') return viewSearch();
    if (route === 'plan') return viewPlan(parts[1]);
    return viewHome();
  }

  /* ============================================================
     ホーム
     ============================================================ */
  function progressSummary() {
    const readCount = DATA.chapters.filter(c => STORE.read[c.num]).length;
    const cardsKnown = Object.values(STORE.cards).filter(v => v === 'known').length;
    const mockHist = STORE.quiz.history.filter(h => h.isMock);
    const bestMock = mockHist.length ? Math.max(...mockHist.map(h => pct(h.correct, h.total))) : null;
    let seen = 0, correct = 0;
    Object.values(STORE.quiz.stats).forEach(s => { seen += s.seen; correct += s.correct; });
    const acc = seen ? pct(correct, seen) : null;
    return { readCount, cardsKnown, bestMock, acc, answered: Object.keys(STORE.quiz.stats).length };
  }

  function viewHome() {
    const s = progressSummary();
    const days = Math.ceil((EXAM_DATE - new Date()) / 86400000);
    const countdown = days > 0
      ? `<div class="countdown"><div class="num">${days}</div><div class="lbl">DAYS TO EXAM</div></div>` : '';

    const stat = (label, value, sub, p) => `
      <div class="stat card">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}${sub ? ` <small>${sub}</small>` : ''}</span>
        ${p != null ? `<div class="bar"><span style="width:${p}%"></span></div>` : ''}
      </div>`;

    const quick = [
      ['📖', '本編テキストを読む', `全${DATA.chapters.length}章 / HCDの流れを体系的に`, '#/read'],
      ['🗂️', '単語カードで覚える', `重要語句 ${DATA.glossary.length} 語を暗記`, '#/cards'],
      ['📝', '模擬問題で解く', `本番形式 ${DATA.mockQuestions.length} 問 + 章別ミニ問題`, '#/quiz'],
      ['🔁', '間違いを復習', '誤答した問題だけを集中演習', '#/quiz']
    ].map(([i, t, d, h]) => `
      <a class="card" href="${h}">
        <span class="q-ico">${i}</span>
        <span class="q-body"><h3>${t}</h3><p>${d}</p></span>
      </a>`).join('');

    const facts = EXAM_FACTS.map(([k, v]) => `<li><span class="k">${k}</span><span class="v">${esc(v)}</span></li>`).join('');

    setView(`
      <section class="hero">
        ${countdown}
        <h1>UX検定基礎 学習サイト</h1>
        <p>UXを「画面の見た目」ではなく、ユーザー理解 → 価値仮説 → 要求定義 → 具現化 → 評価 → 運用・組織化までの一連の活動として学びます。「読む・覚える・解く」を行き来して、用語の使い分けを身につけましょう。</p>
        <div class="hero-actions">
          <a class="btn primary" href="#/read">学習をはじめる</a>
          <a class="btn ghost" href="#/quiz">模擬試験に挑戦</a>
        </div>
      </section>

      <div class="section-title"><span class="dot"></span>あなたの学習状況</div>
      <div class="grid cols-4">
        ${stat('読了した章', s.readCount, `/ ${DATA.chapters.length} 章`, pct(s.readCount, DATA.chapters.length))}
        ${stat('覚えた語句', s.cardsKnown, `/ ${DATA.glossary.length} 語`, pct(s.cardsKnown, DATA.glossary.length))}
        ${stat('模試ベスト', s.bestMock == null ? '—' : s.bestMock + '%', s.bestMock == null ? '未受験' : '正答率', s.bestMock)}
        ${stat('演習正答率', s.acc == null ? '—' : s.acc + '%', s.acc == null ? '未演習' : `${s.answered}問演習`, s.acc)}
      </div>

      <div class="section-title"><span class="dot"></span>今日のはじめかた</div>
      <div class="grid cols-2 quick-grid">${quick}</div>

      <div class="section-title"><span class="dot"></span>試験概要</div>
      <div class="grid cols-2">
        <div class="card" style="padding:18px 20px"><ul class="fact-list">${facts}</ul></div>
        <div class="card" style="padding:20px">
          <h3 style="margin:0 0 8px;font-size:16px">学習の進め方（おすすめ）</h3>
          <p class="text-soft" style="font-size:14px;margin:0 0 12px">用語を単体で覚えるのではなく、似た概念の違いを説明できる状態を目指します。</p>
          <ol style="margin:0;padding-left:1.2em;font-size:14px;line-height:1.9">
            <li>各章を読む（要点・関連語の違い・実務例）</li>
            <li>章末のミニ問題で使い分けを確認</li>
            <li>単語カードで重要語句を反復</li>
            <li>模擬問題100問を時間を計って演習</li>
            <li>間違いを章へ戻って復習</li>
          </ol>
          <div class="btn-row" style="margin-top:14px">
            <a class="btn sm" href="#/plan">学習計画を見る</a>
            <a class="btn sm ghost" href="#/plan/syllabus">シラバス網羅表</a>
          </div>
        </div>
      </div>
    `);
  }

  /* ============================================================
     読む（章リスト）
     ============================================================ */
  const SECTIONS_META = [
    ['understand', 'この章で理解すべきこと', '🎯'],
    ['concept', '基本概念', '📘'],
    ['related', '関連語との違い', '🔀'],
    ['practice', '実務例', '🛠️'],
    ['pitfalls', '試験で間違えやすいポイント', '⚠️'],
    ['memo', '直前暗記メモ', '🧠']
  ];

  function chapterSubtitle(c) {
    const u = c.sections.understand || '';
    const first = u.split('\n').find(l => l.trim()) || '';
    return first.replace(/^\s*[-*]\s*/, '').replace(/。.*$/, '。');
  }

  function viewReadList() {
    const readCount = DATA.chapters.filter(c => STORE.read[c.num]).length;
    const items = DATA.chapters.map(c => {
      const done = !!STORE.read[c.num];
      return `
        <a class="card ch-item ${done ? 'done' : ''}" href="#/read/${c.num}">
          <span class="ch-num">${done ? '✓' : c.num}</span>
          <span class="ch-meta"><h3>${esc(c.title)}</h3><p>${esc(chapterSubtitle(c))}</p></span>
          <span class="ch-status">${done ? '<span class="done-tag">読了</span>' : 'ミニ問題 ' + c.miniQuiz.length + '問'}</span>
        </a>`;
    }).join('');
    setView(`
      <div class="page-head">
        <span class="eyebrow">本編テキスト</span>
        <h1>全${DATA.chapters.length}章を読む</h1>
        <p>UX検定基礎のシラバスに沿った9章構成。読み終えたら章末のミニ問題で理解を確認しましょう（読了 ${readCount}/${DATA.chapters.length}）。</p>
      </div>
      <div class="ch-list">${items}</div>
    `);
  }

  /* ---------- 章ページ ---------- */
  function viewChapter(num) {
    const c = DATA.chapters.find(x => x.num === num);
    if (!c) return navigate('#/read');
    const done = !!STORE.read[num];

    const toc = SECTIONS_META.filter(([k]) => c.sections[k] != null)
      .map(([k, label, ico]) => `<a href="#sec-${k}">${ico} ${label}</a>`).join('')
      + `<a href="#sec-quiz">❓ ミニ確認問題</a>`;

    const sections = SECTIONS_META.map(([k, label, ico]) => {
      const body = c.sections[k];
      if (body == null) return '';
      const inner = `<div class="doc-body ${k === 'memo' ? '' : ''}">${md(body)}</div>`;
      const wrap = k === 'memo'
        ? `<div class="memo-box">${inner}</div>`
        : inner;
      return `<section class="doc-section" id="sec-${k}"><h2><span class="ico">${ico}</span>${label}</h2>${wrap}</section>`;
    }).join('');

    const prev = DATA.chapters.find(x => x.num === num - 1);
    const next = DATA.chapters.find(x => x.num === num + 1);

    setView(`
      <div class="breadcrumbs"><a href="#/read">本編テキスト</a> › 第${num}章</div>
      <div class="page-head">
        <span class="eyebrow">第${num}章</span>
        <h1>${esc(c.title.replace(/^第\d+章\s*/, ''))}</h1>
      </div>
      <div class="reader">
        <aside class="toc card">
          <h4>このページの目次</h4>
          ${toc}
          <div style="margin-top:12px">
            <button class="btn sm ${done ? 'teal' : 'primary'} block" id="readBtn">${done ? '✓ 読了済み' : '読了にする'}</button>
          </div>
        </aside>
        <div>
          ${sections}
          <section class="doc-section" id="sec-quiz">
            <h2><span class="ico">❓</span>ミニ確認問題（${c.miniQuiz.length}問）</h2>
            <p class="text-soft">この章の理解度を4択で確認します。即時に解説が表示されます。</p>
            <button class="btn primary" id="chQuizBtn">この章のミニ問題を解く</button>
          </section>
          <div class="reader-nav">
            ${prev ? `<a class="btn ghost" href="#/read/${prev.num}">‹ 第${prev.num}章</a>` : '<span></span>'}
            ${next ? `<a class="btn ghost" href="#/read/${next.num}">第${next.num}章 ›</a>` : `<a class="btn ghost" href="#/quiz">問題演習へ ›</a>`}
          </div>
        </div>
      </div>
    `, () => {
      document.getElementById('readBtn').addEventListener('click', () => {
        if (STORE.read[num]) { delete STORE.read[num]; } else { STORE.read[num] = Date.now(); toast('読了にしました'); }
        save(); viewChapter(num);
      });
      document.getElementById('chQuizBtn').addEventListener('click', () => {
        startQuiz({ mode: 'practice', instant: true, title: `第${num}章 ミニ問題`,
          questions: c.miniQuiz.map(q => normQ('mini', q)) });
      });
    });
  }

  /* ============================================================
     単語カード
     ============================================================ */
  let CARDS = null;
  function cardState(term) { return STORE.cards[term] || 'new'; }
  function buildCardList(filter) {
    let list = DATA.glossary.slice();
    if (filter === 'new') list = list.filter(g => cardState(g.term) !== 'known');
    else if (filter === 'review') list = list.filter(g => cardState(g.term) === 'review');
    else if (filter === 'known') list = list.filter(g => cardState(g.term) === 'known');
    return list;
  }

  function viewCards() {
    if (!CARDS) CARDS = { filter: 'all', idx: 0, flipped: false, list: buildCardList('all') };
    const knownCount = Object.values(STORE.cards).filter(v => v === 'known').length;
    setView(`
      <div class="page-head">
        <span class="eyebrow">重要語句集</span>
        <h1>単語カード</h1>
        <p>${DATA.glossary.length}語の重要語句を暗記カードで反復。カードをタップ（またはスペースキー）でめくり、「覚えた / もう一度」で仕分けします（覚えた ${knownCount}/${DATA.glossary.length}）。</p>
      </div>
      <div class="cards-toolbar">
        <div class="seg" id="cardFilter">
          <button data-f="all">すべて</button>
          <button data-f="new">未学習</button>
          <button data-f="review">要復習</button>
          <button data-f="known">覚えた</button>
        </div>
        <div style="flex:1"></div>
        <button class="btn sm ghost" id="shuffleBtn">🔀 シャッフル</button>
        <a class="btn sm ghost" href="#/glossary">一覧で見る</a>
      </div>
      <div id="cardStage"></div>
    `, () => {
      document.querySelectorAll('#cardFilter button').forEach(b => {
        b.classList.toggle('active', b.dataset.f === CARDS.filter);
        b.addEventListener('click', () => {
          CARDS.filter = b.dataset.f; CARDS.list = buildCardList(b.dataset.f); CARDS.idx = 0; CARDS.flipped = false;
          viewCards();
        });
      });
      document.getElementById('shuffleBtn').addEventListener('click', () => {
        CARDS.list = shuffle(CARDS.list); CARDS.idx = 0; CARDS.flipped = false; drawCard();
      });
      drawCard();
    });
  }

  function drawCard() {
    const stage = document.getElementById('cardStage');
    if (!stage) return;
    const list = CARDS.list;
    if (!list.length) {
      stage.innerHTML = `<div class="empty-state"><div class="big">🎉</div><p>この条件のカードはありません。</p></div>`;
      return;
    }
    if (CARDS.idx >= list.length) CARDS.idx = list.length - 1;
    const g = list[CARDS.idx];
    const st = cardState(g.term);
    const stBadge = st === 'known' ? '<span class="chip green">覚えた</span>'
      : st === 'review' ? '<span class="chip amber">要復習</span>' : '';
    const row = (lbl, val) => val ? `<dt>${lbl}</dt><dd>${esc(val)}</dd>` : '';
    stage.innerHTML = `
      <div class="flashcard-stage">
        <div class="flashcard ${CARDS.flipped ? 'flipped' : ''}" id="flash">
          <div class="inner">
            <div class="face front">
              <span class="badge-state">${stBadge}</span>
              <div class="term">${esc(g.term)}</div>
              <div class="hint">タップで意味を表示</div>
            </div>
            <div class="face back">
              <span class="badge-state">${stBadge}</span>
              <div class="term">${esc(g.term)}</div>
              <dl>
                ${row('一言定義', g.def)}
                ${row('詳しい説明', g.desc)}
                ${row('関連語', g.related)}
                ${row('混同しやすい語', g.confusing)}
                ${row('実務例', g.practice)}
                ${row('試験での注意点', g.note)}
              </dl>
            </div>
          </div>
        </div>
        <div class="card-progress">${CARDS.idx + 1} / ${list.length}</div>
        <div class="flashcard-controls">
          <button class="btn ghost" id="prevCard">‹ 前へ</button>
          <button class="btn ghost" id="flipBtn">めくる</button>
          <button class="btn" style="border-color:var(--amber);color:var(--amber)" id="reviewBtn">もう一度</button>
          <button class="btn teal" id="knownBtn">覚えた ✓</button>
          <button class="btn ghost" id="nextCard">次へ ›</button>
        </div>
      </div>`;
    const flip = () => { CARDS.flipped = !CARDS.flipped; document.getElementById('flash').classList.toggle('flipped', CARDS.flipped); };
    document.getElementById('flash').addEventListener('click', flip);
    document.getElementById('flipBtn').addEventListener('click', e => { e.stopPropagation(); flip(); });
    document.getElementById('prevCard').addEventListener('click', () => move(-1));
    document.getElementById('nextCard').addEventListener('click', () => move(1));
    document.getElementById('knownBtn').addEventListener('click', () => mark('known'));
    document.getElementById('reviewBtn').addEventListener('click', () => mark('review'));
  }
  function move(d) {
    const n = CARDS.idx + d;
    if (n < 0 || n >= CARDS.list.length) return;
    CARDS.idx = n; CARDS.flipped = false; drawCard();
  }
  function mark(state) {
    const g = CARDS.list[CARDS.idx]; if (!g) return;
    STORE.cards[g.term] = state; save();
    toast(state === 'known' ? '覚えた！' : '要復習に登録');
    if (CARDS.idx < CARDS.list.length - 1) { CARDS.idx++; CARDS.flipped = false; drawCard(); }
    else drawCard();
  }

  function viewGlossaryTable() {
    const rows = DATA.glossary.map(g => `
      <tr>
        <td class="term-cell">${esc(g.term)}</td>
        <td>${esc(g.def)}</td>
        <td class="muted">${esc(g.confusing || '—')}</td>
      </tr>`).join('');
    setView(`
      <div class="breadcrumbs"><a href="#/cards">単語カード</a> › 一覧</div>
      <div class="page-head"><span class="eyebrow">重要語句集</span><h1>用語一覧（${DATA.glossary.length}語）</h1>
        <p>一言定義と「混同しやすい語」を一覧で確認できます。詳しい説明や実務例は<a href="#/cards">単語カード</a>で。</p></div>
      <div class="card" style="padding:4px 8px;overflow-x:auto">
        <table class="glossary-table">
          <thead><tr><th>用語</th><th>一言定義</th><th>混同しやすい語</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  /* ============================================================
     問題演習メニュー
     ============================================================ */
  function viewQuizMenu() {
    const wrongN = ALL_Q.filter(q => { const s = STORE.quiz.stats[q.key]; return s && s.lastCorrect === false; }).length;

    // カテゴリ別（模試）
    const cats = {};
    DATA.mockQuestions.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
    const catBtns = Object.keys(cats).map(cat =>
      `<button class="cat-btn" data-cat="${esc(cat)}"><span>${esc(cat)}</span><span class="cnt">${cats[cat]}問</span></button>`).join('');

    const chapBtns = DATA.chapters.map(c =>
      `<button class="cat-btn" data-ch="${c.num}"><span>第${c.num}章</span><span class="cnt">${c.miniQuiz.length}問</span></button>`).join('');

    const card = (ico, title, desc, body) => `
      <div class="card quiz-menu-card">
        <h3><span class="ico">${ico}</span>${title}</h3>
        <p>${desc}</p>
        ${body}
      </div>`;

    setView(`
      <div class="page-head">
        <span class="eyebrow">問題演習</span>
        <h1>問題で力をつける</h1>
        <p>模擬問題はすべてオリジナルです。「なぜ他の選択肢が違うか」を説明できるかを意識して解きましょう。</p>
      </div>
      <div class="quiz-menu-grid">
        ${card('📝', '本番モード模試', '本番形式100問を100分で。解説は採点後にまとめて確認します。',
          '<div class="btn-row"><button class="btn primary" id="mockBtn">100問の模試を開始</button></div>')}
        ${card('⚡', 'クイック演習', 'ランダム出題＋即時解説。スキマ時間の反復に。',
          '<div class="btn-row"><button class="btn" data-rand="10">10問</button><button class="btn" data-rand="20">20問</button><button class="btn" data-rand="50">50問</button></div>')}
        ${card('🔁', '間違い復習', `直近で誤答した問題だけを集中演習します（現在 ${wrongN} 問）。`,
          `<div class="btn-row"><button class="btn ${wrongN ? 'teal' : ''}" id="wrongBtn" ${wrongN ? '' : 'disabled'}>間違い ${wrongN}問を復習</button></div>`)}
        ${card('🧩', 'すべての模試問題', '100問を順番に、即時解説つきで演習します。',
          '<div class="btn-row"><button class="btn" id="allBtn">100問を即時解説で</button></div>')}
      </div>

      <div class="section-title"><span class="dot"></span>カテゴリ別演習（即時解説）</div>
      <div class="cat-grid" id="catGrid">${catBtns}</div>

      <div class="section-title"><span class="dot"></span>章別ミニ確認問題</div>
      <div class="cat-grid" id="chapGrid">${chapBtns}</div>
    `, () => {
      document.getElementById('mockBtn').addEventListener('click', startMock);
      document.getElementById('allBtn').addEventListener('click', () => startQuiz({
        mode: 'practice', instant: true, title: '模試100問（即時解説）',
        questions: DATA.mockQuestions.map(q => normQ('mock', q))
      }));
      document.querySelectorAll('[data-rand]').forEach(b => b.addEventListener('click', () => {
        const n = Number(b.dataset.rand);
        startQuiz({ mode: 'practice', instant: true, title: `クイック演習 ${n}問`,
          questions: shuffle(ALL_Q).slice(0, n) });
      }));
      const wb = document.getElementById('wrongBtn');
      if (wb && !wb.disabled) wb.addEventListener('click', () => startQuiz({
        mode: 'practice', instant: true, title: '間違い復習',
        questions: shuffle(ALL_Q.filter(q => { const s = STORE.quiz.stats[q.key]; return s && s.lastCorrect === false; }))
      }));
      document.querySelectorAll('#catGrid .cat-btn').forEach(b => b.addEventListener('click', () => {
        const cat = b.dataset.cat;
        startQuiz({ mode: 'practice', instant: true, title: `カテゴリ：${cat}`,
          questions: DATA.mockQuestions.filter(q => q.category === cat).map(q => normQ('mock', q)) });
      }));
      document.querySelectorAll('#chapGrid .cat-btn').forEach(b => b.addEventListener('click', () => {
        const n = Number(b.dataset.ch); const c = DATA.chapters.find(x => x.num === n);
        startQuiz({ mode: 'practice', instant: true, title: `第${n}章 ミニ問題`,
          questions: c.miniQuiz.map(q => normQ('mini', q)) });
      }));
    });
  }

  function startMock() {
    startQuiz({ mode: 'exam', instant: false, isMock: true, title: '本番モード模試（100問）',
      questions: shuffle(DATA.mockQuestions.map(q => normQ('mock', q))), timerSec: 100 * 60 });
  }

  /* ============================================================
     クイズ実行エンジン
     ============================================================ */
  let SESSION = null;
  function startQuiz(opts) {
    if (!opts.questions || !opts.questions.length) { toast('対象の問題がありません'); return; }
    SESSION = {
      mode: opts.mode, instant: !!opts.instant, isMock: !!opts.isMock, title: opts.title,
      questions: opts.questions, idx: 0, answers: {},
      timerSec: opts.timerSec || 0, remain: opts.timerSec || 0, result: null
    };
    navigate('#/quiz/run');
  }

  function viewQuizRun() {
    if (!SESSION) return navigate('#/quiz');
    const exam = SESSION.mode === 'exam';
    setView(`
      <div class="quiz-run">
        <div class="quiz-top">
          <button class="btn sm ghost" id="quitBtn">‹ 中断</button>
          <strong style="font-size:14px">${esc(SESSION.title)}</strong>
          ${exam ? '<span class="quiz-timer" id="timer">--:--</span>' : '<span class="muted" id="counter"></span>'}
        </div>
        <div class="quiz-progressbar"><span id="pbar"></span></div>
        <div id="qregion"></div>
      </div>
    `, () => {
      document.getElementById('quitBtn').addEventListener('click', () => {
        if (confirm('演習を中断してメニューに戻りますか？（成績は記録されません）')) { SESSION = null; navigate('#/quiz'); }
      });
      document.getElementById('qregion').addEventListener('click', onRunClick);
      if (exam && SESSION.remain > 0) startTimer();
      drawQuestion();
    });
  }

  function startTimer() {
    const el = document.getElementById('timer');
    const upd = () => {
      const m = Math.floor(SESSION.remain / 60), s = SESSION.remain % 60;
      if (el) { el.textContent = `${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('warn', SESSION.remain <= 300); }
    };
    upd();
    TIMER = setInterval(() => {
      SESSION.remain--;
      if (SESSION.remain <= 0) { clearInterval(TIMER); TIMER = null; toast('時間終了'); finishQuiz(); return; }
      upd();
    }, 1000);
  }

  function drawQuestion() {
    const region = document.getElementById('qregion'); if (!region) return;
    const exam = SESSION.mode === 'exam';
    const total = SESSION.questions.length;
    const q = SESSION.questions[SESSION.idx];
    const chosen = SESSION.answers[q.key];
    const answered = chosen != null;
    const reveal = SESSION.instant && answered; // 即時解説モードで回答済み

    const pbarEl = document.getElementById('pbar');
    if (pbarEl) pbarEl.style.width = pct(SESSION.idx + 1, total) + '%';
    const counter = document.getElementById('counter');
    if (counter) counter.textContent = `${SESSION.idx + 1} / ${total}`;

    const opts = ['A', 'B', 'C', 'D'].filter(k => q.options[k] != null).map(k => {
      let cls = 'opt';
      if (reveal) {
        if (k === q.answer) cls += ' correct';
        else if (k === chosen) cls += ' wrong';
      } else if (k === chosen) cls += ' selected';
      return `<button class="${cls}" data-opt="${k}" ${reveal ? 'disabled' : ''}>
          <span class="key">${k}</span><span>${esc(q.options[k])}</span></button>`;
    }).join('');

    let feedback = '';
    if (reveal) {
      const ok = chosen === q.answer;
      const why = Object.keys(q.wrong).map(k => `<li><strong>${k}</strong>：${esc(q.wrong[k])}</li>`).join('');
      feedback = `
        <div class="feedback show ${ok ? 'ok' : 'ng'}">
          <div class="verdict">${ok ? '◯ 正解' : '✕ 不正解'}<span class="muted" style="font-weight:600">　正解は ${q.answer}</span></div>
          <p class="explain">${esc(q.explain)}</p>
          ${why ? `<ul class="why">${why}</ul>` : ''}
        </div>`;
    }

    // アクション
    let actions = '';
    const last = SESSION.idx === total - 1;
    if (exam) {
      actions = `
        <button class="btn ghost" data-act="prev" ${SESSION.idx === 0 ? 'disabled' : ''}>‹ 前の問題</button>
        ${last ? '<button class="btn primary" data-act="submit">採点する</button>'
               : '<button class="btn" data-act="next">次の問題 ›</button>'}`;
    } else {
      actions = `
        <button class="btn ghost" data-act="prev" ${SESSION.idx === 0 ? 'disabled' : ''}>‹ 前へ</button>
        ${answered ? (last ? '<button class="btn primary" data-act="finish">結果を見る</button>'
                            : '<button class="btn primary" data-act="next">次へ ›</button>')
                   : '<span class="muted" style="align-self:center;font-size:13px">選択肢を選んでください</span>'}`;
    }

    region.innerHTML = `
      <div class="q-card card">
        <div class="q-cat">${esc(q.category)}${q.kind === 'mock' ? '　/　問' + q.id : ''}</div>
        <p class="q-text">${esc(q.q)}</p>
        <div class="options">${opts}</div>
        ${feedback}
      </div>
      <div class="quiz-actions">${actions}</div>`;
  }

  function onRunClick(e) {
    const opt = e.target.closest('.opt');
    if (opt && !opt.disabled) {
      const k = opt.dataset.opt;
      const q = SESSION.questions[SESSION.idx];
      if (SESSION.instant && SESSION.answers[q.key] != null) return; // 確定後は変更不可
      SESSION.answers[q.key] = k;
      drawQuestion();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'next') { SESSION.idx = Math.min(SESSION.idx + 1, SESSION.questions.length - 1); drawQuestion(); }
    else if (a === 'prev') { SESSION.idx = Math.max(SESSION.idx - 1, 0); drawQuestion(); }
    else if (a === 'finish' || a === 'submit') {
      if (a === 'submit') {
        const un = SESSION.questions.filter(q => SESSION.answers[q.key] == null).length;
        if (un && !confirm(`未回答が ${un} 問あります。採点しますか？`)) return;
      }
      finishQuiz();
    }
  }

  function finishQuiz() {
    if (TIMER) { clearInterval(TIMER); TIMER = null; }
    let correct = 0;
    SESSION.questions.forEach(q => {
      const a = SESSION.answers[q.key];
      const ok = a === q.answer;
      if (ok) correct++;
      const st = STORE.quiz.stats[q.key] || { seen: 0, correct: 0, wrong: 0, lastCorrect: false };
      st.seen++; if (ok) { st.correct++; st.lastCorrect = true; } else { st.wrong++; st.lastCorrect = false; }
      STORE.quiz.stats[q.key] = st;
    });
    STORE.quiz.history.push({ ts: Date.now(), mode: SESSION.mode, label: SESSION.title,
      total: SESSION.questions.length, correct, isMock: SESSION.isMock });
    if (STORE.quiz.history.length > 200) STORE.quiz.history = STORE.quiz.history.slice(-200);
    save();
    SESSION.result = { correct };
    navigate('#/quiz/result');
  }

  /* ---------- 結果 ---------- */
  function viewQuizResult() {
    if (!SESSION || !SESSION.result) return navigate('#/quiz');
    const total = SESSION.questions.length, correct = SESSION.result.correct;
    const p = pct(correct, total);
    const msg = p >= 90 ? '素晴らしい！合格圏の手応えです。' : p >= 75 ? 'good！あと一歩、間違いを復習しましょう。'
      : p >= 60 ? 'もう少し。間違えた章へ戻って固めましょう。' : '基礎を読み直してから再挑戦しましょう。';

    // カテゴリ別内訳
    const byCat = {};
    SESSION.questions.forEach(q => {
      const c = byCat[q.category] || (byCat[q.category] = { t: 0, c: 0 });
      c.t++; if (SESSION.answers[q.key] === q.answer) c.c++;
    });
    const catRows = Object.keys(byCat).sort((a, b) => (byCat[a].c / byCat[a].t) - (byCat[b].c / byCat[b].t))
      .map(cat => {
        const o = byCat[cat], pp = pct(o.c, o.t);
        return `<div class="row"><span class="label">${esc(cat)}</span>
          <span><span class="mini-bar"><span style="width:${pp}%;background:${pp >= 70 ? 'var(--green)' : pp >= 40 ? 'var(--amber)' : 'var(--red)'}"></span></span>${o.c}/${o.t}</span></div>`;
      }).join('');

    // 間違いレビュー
    const wrong = SESSION.questions.filter(q => SESSION.answers[q.key] !== q.answer);
    const reviewHtml = wrong.map(q => {
      const a = SESSION.answers[q.key];
      const why = Object.keys(q.wrong).map(k => `<li><strong>${k}</strong>：${esc(q.wrong[k])}</li>`).join('');
      return `
        <div class="card review-item">
          <div class="q-cat">${esc(q.category)}${q.kind === 'mock' ? '　/　問' + q.id : ''}</div>
          <p class="q-text">${esc(q.q)}</p>
          <p class="ans-line your"><span class="tag">あなたの解答：</span>${a ? `${a}. ${esc(q.options[a])}` : '未回答'}</p>
          <p class="ans-line right"><span class="tag">正解：</span>${q.answer}. ${esc(q.options[q.answer])}</p>
          <div class="feedback show" style="margin-top:10px"><p class="explain">${esc(q.explain)}</p>${why ? `<ul class="why">${why}</ul>` : ''}</div>
        </div>`;
    }).join('');

    setView(`
      <div class="result-hero card">
        <div class="score-ring" style="--p:${p}"><div class="inner"><div class="pct">${p}%</div><div class="frac">${correct} / ${total} 問正解</div></div></div>
        <div class="result-msg">${msg}</div>
        <p class="muted">${esc(SESSION.title)}${SESSION.isMock ? '（本番形式）' : ''}</p>
        <div class="btn-row" style="justify-content:center;margin-top:14px">
          ${wrong.length ? '<button class="btn teal" id="reviewWrongBtn">間違い ' + wrong.length + '問だけ復習</button>' : ''}
          <button class="btn primary" id="retryBtn">もう一度</button>
          <a class="btn ghost" href="#/quiz">メニューへ</a>
        </div>
      </div>

      <div class="section-title"><span class="dot"></span>カテゴリ別の正答</div>
      <div class="card" style="padding:8px 18px"><div class="cat-breakdown">${catRows}</div></div>

      ${wrong.length ? `<div class="section-title"><span class="dot"></span>復習：間違えた問題（${wrong.length}問）</div>${reviewHtml}`
        : '<div class="section-title"><span class="dot"></span>全問正解！</div><div class="empty-state"><div class="big">🏆</div><p>このセットは全問正解です。お見事！</p></div>'}
    `, () => {
      const retry = document.getElementById('retryBtn');
      retry.addEventListener('click', () => startQuiz({
        mode: SESSION.mode, instant: SESSION.instant, isMock: SESSION.isMock, title: SESSION.title,
        questions: SESSION.isMock ? shuffle(SESSION.questions) : SESSION.questions, timerSec: SESSION.timerSec
      }));
      const rw = document.getElementById('reviewWrongBtn');
      if (rw) rw.addEventListener('click', () => startQuiz({
        mode: 'practice', instant: true, title: SESSION.title + '（間違い復習）', questions: wrong
      }));
    });
  }

  /* ============================================================
     検索
     ============================================================ */
  function viewSearch() {
    setView(`
      <div class="page-head"><span class="eyebrow">検索</span><h1>教材を横断検索</h1>
        <p>重要語句・本編テキスト・模擬問題をまとめて検索します。</p></div>
      <div class="search-box">
        <span class="ico">🔎</span>
        <input id="searchInput" type="search" placeholder="例：ユーザビリティ、ペルソナ、定性調査 …" autocomplete="off" />
      </div>
      <div id="searchResults"></div>
    `, () => {
      const input = document.getElementById('searchInput');
      input.focus();
      input.addEventListener('input', () => doSearch(input.value.trim()));
    });
  }

  function hl(text, q) {
    if (!q) return esc(text);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(text.length > 110 ? text.slice(0, 110) + '…' : text);
    const start = Math.max(0, idx - 30);
    let snip = (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 70) + (idx + q.length + 70 < text.length ? '…' : '');
    return esc(snip).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
  }

  function doSearch(q) {
    const box = document.getElementById('searchResults');
    if (!q) { box.innerHTML = '<p class="muted" style="text-align:center;padding:30px">キーワードを入力してください。</p>'; return; }
    const lq = q.toLowerCase();
    const inc = s => (s || '').toLowerCase().indexOf(lq) >= 0;

    const gloss = DATA.glossary.filter(g => inc(g.term) || inc(g.def) || inc(g.desc) || inc(g.related) || inc(g.confusing)).slice(0, 20);
    const chaps = [];
    DATA.chapters.forEach(c => {
      const keys = ['understand', 'concept', 'related', 'practice', 'pitfalls', 'memo'];
      const hit = keys.find(k => inc(c.sections[k])) || (inc(c.title) ? 'concept' : null);
      if (hit) chaps.push({ c, text: c.sections[hit] || c.title });
    });
    const ques = ALL_Q.filter(x => inc(x.q) || inc(x.category)).slice(0, 15);

    let html = '';
    if (gloss.length) html += `<div class="search-group"><h3>重要語句（${gloss.length}）</h3>` +
      gloss.map(g => `<a class="card search-hit" href="#/cards"><h4>${hl(g.term, q)}</h4><p>${hl(g.def, q)}</p></a>`).join('') + '</div>';
    if (chaps.length) html += `<div class="search-group"><h3>本編テキスト（${chaps.length}）</h3>` +
      chaps.map(o => `<a class="card search-hit" href="#/read/${o.c.num}"><h4>${esc(o.c.title)}</h4><p>${hl(o.text.replace(/\n+/g, ' '), q)}</p></a>`).join('') + '</div>';
    if (ques.length) html += `<div class="search-group"><h3>問題（${ques.length}）</h3>` +
      ques.map(x => `<div class="card search-hit"><h4>${esc(x.category)}${x.kind === 'mock' ? '・問' + x.id : ''}</h4><p>${hl(x.q, q)}</p></div>`).join('') + '</div>';
    if (!html) html = `<div class="empty-state"><div class="big">🔍</div><p>「${esc(q)}」に一致する内容は見つかりませんでした。</p></div>`;
    box.innerHTML = html;
  }

  /* ============================================================
     計画・資料
     ============================================================ */
  function viewPlan(tab) {
    const tabs = [
      ['overview', '試験概要'],
      ['syllabus', 'シラバス網羅表'],
      ['memo', '直前復習メモ'],
      ['plan2', '2週間計画'],
      ['plan4', '4週間計画']
    ];
    const active = tabs.find(t => t[0] === tab) ? tab : 'overview';
    const content = {
      overview: md(DATA.examOverview),
      syllabus: md(DATA.syllabus),
      memo: md(DATA.reviewMemo),
      plan2: md(DATA.plan2),
      plan4: md(DATA.plan4)
    }[active];
    setView(`
      <div class="page-head"><span class="eyebrow">計画・資料</span><h1>学習計画と公式資料</h1>
        <p>試験概要・シラバス網羅表・直前メモ・学習計画をまとめています。</p></div>
      <div class="tabs">${tabs.map(t => `<button data-tab="${t[0]}" class="${t[0] === active ? 'active' : ''}">${t[1]}</button>`).join('')}</div>
      <div class="card" style="padding:8px 22px"><div class="doc-render">${content}</div></div>
    `, () => {
      document.querySelectorAll('.tabs button').forEach(b =>
        b.addEventListener('click', () => navigate('#/plan/' + b.dataset.tab)));
    });
  }

  /* ============================================================
     ナビ・テーマ・起動
     ============================================================ */
  function closeMenu() {
    document.getElementById('topnav').classList.remove('open');
    document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
  }
  document.getElementById('menuToggle').addEventListener('click', () => {
    const nav = document.getElementById('topnav');
    const open = nav.classList.toggle('open');
    document.getElementById('menuToggle').setAttribute('aria-expanded', String(open));
  });

  // テーマ
  const savedTheme = localStorage.getItem('uxtheme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('uxtheme', cur);
  });

  // キーボード操作（単語カード）
  document.addEventListener('keydown', e => {
    if (!location.hash.startsWith('#/cards') || !CARDS) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); CARDS.flipped = !CARDS.flipped; const f = document.getElementById('flash'); if (f) f.classList.toggle('flipped', CARDS.flipped); }
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === '1') mark('review');
    else if (e.key === '2') mark('known');
  });

  window.addEventListener('hashchange', render);
  render();
})();
