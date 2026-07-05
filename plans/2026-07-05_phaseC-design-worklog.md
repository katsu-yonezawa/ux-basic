# Phase C（リッチ化 P2全件）作業ログ

- 実施日: 2026-07-05
- 対象: `site/css/style.css`, `site/js/app.js`（学習ロジックは未変更）
- build: `node site/build.js` exit 0 / warnings 0 / errors 0 を確認
- 方針書: `plans/2026-07-05_ui-design-improvement-plan.md`

## P2-1 章リストのサムネイル化（§3.5）

- `viewReadList()` に `CHAPTER_VISUALS` のサムネイル（幅112px、`aspect-ratio: 1672/941`、`border-radius: var(--radius-sm)`、`loading="lazy"`、装飾のため `alt=""`）を追加。9枚の PNG が `site/assets/read-visuals/` に存在することを確認済み
- 読了章: 画像の彩度を落とし（saturate .45）緑の半透明チェックオーバーレイを重ねる → 一覧で読了状態が画像上で判別できる
- 480px 以下はサムネイル幅 84px（章番号バッジは従来どおり画像の左に維持）
- 章ページの `visual-note` を 👀/⚠️ アイコン付きに変更し、640px 以上で2カラム化（モバイル1カラム）

## P2-2 hero 装飾

- 単色グラデの上に `::before` で半透明の radial-gradient メッシュ3個（CSSのみ）。`pointer-events: none`、`.hero > *` に `position: relative` を与えて本文より確実に背面へ。文字は #fff on indigo のまま

## P2-3 進捗・達成演出

- 統計カード: 数値を `--fs-2xl`、バー 7px→8px。達成率100%で `.stat.complete` → 数値が `--green-text`、バーが green に切り替わる
- 「今日のおすすめ」`next-card` に accent の4px左ボーダー（ページ内で最初に目が行く導線に）
- 単語カードのデッキ進捗バー（Phase A で実装済み）

## P2-4 クイズフィードバック強化（§3.2-2/3）

- 正解 `.opt` の key バッジ右上に ✓、誤答に ✕ の丸マーク（`::after`）→ 色弱でも判別可能（`opt-status` テキストは維持）※Phase A の CSS 書き換え時に先行実装
- `.feedback` に verdict 色の4pxアクセント左ボーダー（ok=green / ng=red）
- 演習メニュー4種のアイコンに `q-ico` と同じ色付き丸背景（40px・accent-soft）を導入しホームと視覚言語を統一

## P2-5 マイクロインタラクション（§3.7-3）

- `.btn:active` の scale(.98)
- カード hover lift を `translateY(-2px)` + `--shadow-3` に統一（quick-grid / ch-item / search-hit。ch-item は旧 translateX(2px) から変更）
- `setView()` で `main` に `.view-enter` を付け直し、150ms のフェードイン
- topbar: スクロール時のみ border+shadow 強調（passive な scroll リスナー1つ）、アクティブナビ下に2pxインジケータ
- いずれも `prefers-reduced-motion: reduce` の既存グローバル無効化（animation/transition duration .001ms）配下で無効化される

## P2-6 スコアリングの得点帯色分け（§3.3）

- `score-ring` の conic-gradient を `var(--ring, var(--accent))` 化し、`app.js` から得点帯で渡す: **≥90% green / ≥75% teal / ≥60% amber / 未満 red**（アニメーションなし・色変更のみ＝方針書の許容範囲）
- カテゴリ別内訳: mini-bar 8px化 + 行を `1fr 140px 56px` の3カラムグリッドに整列（分数は tabular-nums 右揃え。480px以下は `1fr 90px 52px`）

## 実装しなかった任意項目

- TOC 現在地ハイライト（IntersectionObserver）— 任意項目のため見送り
- cat-btn への押下済み成績チップ — 任意項目のため見送り

## 受け入れ基準の確認状況

- [x] 9章全部にサムネイル表示のコード + 読了オーバーレイ（画像9枚の存在確認済み）
- [x] リング色4段階の分岐実装（90/75/60閾値）
- [x] 全アニメーションが `prefers-reduced-motion` のグローバル無効化配下にあることをコードで確認
- [x] `node site/build.js` exit 0、`node --check site/js/app.js` OK
- [ ] Lighthouse Accessibility 95+ / 模試結果4段階の実機確認 — ブラウザ環境がないためユーザー確認事項（結果画面の色はクイック演習10問を意図した正答数で4回実施すると確認可能）

## 修正した自己レビュー指摘

- 検索ヒット h4 の flex 化により `<mark>` 分割テキストが匿名 flex アイテム化して gap が挟まる問題 → タイトルを `.hit-title` span でラップして解消
- `.hero::before`（absolute）が静的な子より上に描画される問題 → `.hero > *` に `position: relative` を付与
