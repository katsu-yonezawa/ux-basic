# Phase A（デザイントークン整備 + 重なり根絶 P0全件）作業ログ

- 実施日: 2026-07-05
- 対象: `site/css/style.css`, `site/js/app.js`（学習ロジックは未変更）
- build: `node site/build.js` exit 0 / warnings 0 / errors 0 を確認
- 方針書: `plans/2026-07-05_ui-design-improvement-plan.md`

## デザイントークン導入（§2.1）

`:root` に以下を追加し、ライト/ダーク両テーマで定義した。

- スペーシング `--sp-1`〜`--sp-8`（4pxベース）
- タイポスケール `--fs-xs`〜`--fs-3xl`（12/13.5/15/16.5/19/24/30/38px）
- エレベーション3段階 `--shadow-1/2/3`（既存 `--shadow`/`--shadow-sm` は `var(--shadow-2)`/`var(--shadow-1)` のエイリアスとして互換維持。ダークは shadow-1/2/3 を上書きするためエイリアス経由で自動追随）
- 文字用濃色トークン `--teal-text` `--amber-text` `--green-text` `--red-text`（ライトは #0f766e / #92400e / #166534 / #b91c1c、ダークは現行の明色を流用。コンポーネントへの適用＝P1-4はPhase B）
- `--radius-lg: 20px`、`--card-pad: 20px`、`--card-pad-lg: 24px`
- `.card` にデフォルト `padding: var(--card-pad)` を付与、`.card.flush` で打ち消し可。`.chapter-visual` は `padding: 0` を明示（画像フルブリード維持）
- 最小ユーティリティ `.mt-2/.mt-3/.mt-4` `.spacer` `.btn-row.center` を新設

## P0-1/2/4 単語カードの重なり根絶（§3.1）

`drawCard()` テンプレートを縦フレックス3段構成に書き換え、**絶対配置を全廃**。

- 表裏共通の `.face-head`（通常フロー・`justify-content: space-between`）: 左メタチップ群 / 右状態バッジ。チップが折り返しても本文が押し下がるだけで構造的に重ならない
- 裏面は `.face-body` のみを `overflow-y: auto` にし、ヘッダーは固定表示のまま
- 裏面 `dl` を「定義・説明」「関連語・混同しやすい語」（amber）「実務・試験対策」の3グループ化。`group-label` チップ + 「混同しやすい語」の `dt.warn` を amber 系で強調
- 裏面下端に疑似要素フェード（`.face.back::after`）。scroll リスナーで末尾到達時は `can-scroll` クラスを外してフェードを消す → P0-4「続きがあることが視覚的に分かる」を満たす
- デッキ進捗を「n / N」+ 細バー（`.deck-bar`）の2段表示に
- 「もう一度」ボタンのインライン style を `.btn.warn` クラス化
- `min-height` を 320→340px に微増（裏面3グループのゆとり）。フリップアニメーションは既存維持、ホバーで `--shadow-3` + 2px lift
- 480px の `card-meta/badge-state` static 化応急処置（旧 style.css:622-623）は根本解決に伴い削除

**計画からの意図的な逸脱**: §3.1-1 の「表面に一言定義プレビュー」は実装しない。表面に定義を出すと暗記カードとして答えが見えてしまい学習目的と矛盾するため（未使用だった `.front .one-liner` CSS も削除）。

## P0-3 クイズ sticky ヘッダー（§3.2-1）

- `.quiz-top` + `.quiz-progressbar` を `.quiz-sticky`（`top: 60px`、半透明 `--bg` + blur、z-index 50）にまとめた。模試中もタイトル・タイマー・進捗が常時可視
- 残り5分の `.quiz-timer.warn`: 赤（`--red-text`）+ 17px + `timer-pulse` アニメーション（scale 1.1）。`prefers-reduced-motion: reduce` では既存のグローバル無効化により**色のみ**になる
- タイトルの `style="font-size:14px"` は `.quiz-title` クラス化

## P0-5 hero フレックス化（§3.4-1）

- hero を `.hero-body`（flex:1）+ `.countdown`（static・flex:none）の flex 構成に変更し絶対配置を全廃。760px 以下は縦積み
- 旧 480px の `right/top` 死にスタイル（旧 style.css:621）を削除

## P1-1 インライン style 全廃

`app.js` から静的なインライン style を全廃し、以下に置換:

- ホーム試験概要カード → `.card` デフォルトパディング / `.howto-card`
- 章TOC の余白 → `.mt-3`、カードツールバー → `.spacer`
- 用語一覧ラッパ → `.table-card`、計画 → `.doc-card`、結果内訳 → `.breakdown-card`
- 結果ボタン行 → `.btn-row.center.mt-4`、復習アイテム内 feedback → `.review-item .feedback` の CSS 化
- 検索の空状態 → `.search-empty`、verdict 補足 → `.verdict-sub`、未選択ヒント → `.quiz-hint`
- mini-bar の色は `lv-good/lv-mid/lv-low` クラス化（widthのみ動的値として残置）

`grep -n 'style="' site/js/app.js` の残存ヒットは4件のみで、すべて実行時に値が決まる動的値:
progress width（stat バー・deck-bar・mini-bar）と score-ring の `--p`。

## 受け入れ基準の確認状況

- [x] `node site/build.js` exit 0
- [x] `node --check site/js/app.js` 構文OK
- [x] インライン style 残存が動的値のみ
- [x] 重なりの構造的根絶（絶対配置の全廃をコードレベルで確認）
- [ ] 3幅×2テーマの目視確認 — 本環境にブラウザ自動化ツールがないため未実施。**ユーザーによる §6 チェックリストの目視確認を推奨**（`open site/index.html`）

## 備考

- localStorage キー・データ構造、ハッシュルーティング、`aria-*`/`skip-link`/`:focus-visible`/`prefers-reduced-motion` は変更なし（クラス付け替えのみ）
- `.opt` の正誤 ✓/✕ マーク・feedback 左ボーダーは Phase C 項目だが、同じセレクタ群を触るため本フェーズの CSS に先行して含めた（P2-4）
