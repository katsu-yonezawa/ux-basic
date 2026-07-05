# Phase B（一貫性・可読性 P1残件）作業ログ

- 実施日: 2026-07-05
- 対象: `site/css/style.css`, `site/js/app.js`, `site/index.html`
- build: `node site/build.js` exit 0 / warnings 0 / errors 0 を確認
- 方針書: `plans/2026-07-05_ui-design-improvement-plan.md`

## P1-4 チップ文字色のコントラスト修正

`.chip.teal/green/amber` の文字色を `--teal` 等の流用から `--*-text` トークンへ置換。
コントラスト実測値（WCAG 相対輝度で算出、要件 4.5:1 以上）:

| ペア | ライト | ダーク |
|---|---|---|
| accent-text / accent-soft | #4338ca on #eef0ff = **6.98:1** | #aab4ff on #232c47 = **7.01:1** |
| teal-text / teal-soft | #0f766e on #e3f6f3 = **4.88:1** | #2dd4bf on #15302e = **7.55:1** |
| green-text / green-soft | #166534 on #e4f7ea = **6.38:1** | #4ade80 on #13301f = **8.20:1** |
| amber-text / amber-soft | #92400e on #fdf2dd = **6.39:1** | #fbbf24 on #332817 = **8.64:1** |
| red-text / red-soft | #b91c1c on #fdeaea = **5.59:1** | #f87171 on #331b1d = **5.77:1** |

参考（旧値・不合格）: light amber #d97706 = 2.87:1 / light green #16a34a = 2.95:1 / light teal #0d9488 = 3.34:1。

あわせて小さめ文字色の生色使用を -text 系へ置換済み（Phase A の CSS 全面書き換え時に反映）:
`done-tag`、`feedback .verdict`（ok/ng）、`review-item .your/.right`、`search-hit mark`、`quiz-timer.warn`、`ch-item.done .ch-num`。

## P1-2/3 タイポスケール・スペーシング適用

- `.section-title` 17px → `--fs-lg`（19px）に引き上げ、margin をトークン化 → ホーム・演習メニューの見出し階層を強化
- `.page-head h1` → `--fs-xl`、`.hero h1` → `--fs-2xl`、`.doc-section > h2` / `.q-text` → `--fs-lg`、`.quiz-menu-card h3` / `.ch-meta h3` → `--fs-md`
- 既存のモバイル上書き（23px/22px 等）は挙動維持のため残置。**新規の font-size はトークン以外で書かない**運用に

## P1-5 用語一覧テーブルのモバイルカード化

- `viewGlossaryTable()` の各 `td` に `data-label` 属性を付与
- 760px 以下で `thead` 非表示 + `tr`/`td` を block 化し、`td::before { content: attr(data-label) }` のラベル付き縦積みカードに（CSS のみ）。375px で横スクロール不要に
- 用語セル（`term-cell`）は `white-space: normal` に戻し語自体を見出し化

## P1-6/7 index.html の掃除と meta 追加

- 未使用の Google Fonts preconnect を削除（`grep fonts.googleapis` ヒット0を確認）
- `theme-color` をライト `#f4f6fb` / ダーク `#0f1420` の media 指定で追加
- インライン SVG favicon（data URI・依存ゼロ）: accent→teal グラデの角丸タイルに「UX」。`brand-mark` と同じ意匠

## P1-8 検索ヒット・タブ・doc-render テーブルの統一

- 検索ヒットにヒット種別チップを追加: 語句=accent / 本編=teal / 問題=amber。ホバーは quick-grid と同じ lift（translateY(-2px) + `--shadow-3`）に統一
- **用語ヒットのリンク先改善**: `data-term` を付与し、クリック時に該当用語のカードを直接開く（`CARDS` ビュー状態のみ変更。STORE・startQuiz 等の学習ロジックは未変更）
- 計画タブ: アクティブ下線 2px → 3px
- `doc-render` テーブルに `prose-table` と同じゼブラ（偶数行背景）+ `th` nowrap を適用し、2様式併存を解消

## 受け入れ基準の確認状況

- [x] チップ全色のコントラスト 4.5:1 以上（上表の実測値）
- [x] 未使用 preconnect が消えている / favicon・theme-color 追加
- [x] `node site/build.js` exit 0、`node --check site/js/app.js` OK
- [ ] 375px 幅での用語一覧目視・ブラウザタブの favicon 表示 — ブラウザでの目視確認はユーザー確認事項（`open site/index.html`）
