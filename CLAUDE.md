# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

「UX検定基礎」試験対策の学習サイト。ビルド不要・依存なしの静的サイトで、`site/index.html` をブラウザで開くだけで動く（サーバー不要）。学習進捗は localStorage 保存。GitHub Pages で公開。

## コマンド

```bash
node site/build.js   # docs/*.md + syllabus_keywords.json → site/js/data.js を再生成＋検証
```

これがビルド・テスト・リントを兼ねる。検証エラーがあると終了コード1（CI で検知）。他のツールチェーン・パッケージマネージャ・テストランナーは無い。

## アーキテクチャ

コンテンツ（教材）とアプリ（表示）を分離した一方向のデータパイプライン。

1. **元データ** — `docs/ux_kentei_basic_hcd_study_guide.md`（本編・問題・計画）、`docs/ux_kentei_basic_glossary.md`（重要語句）、`docs/syllabus_keywords.json`（シラバス語句管理）。**コンテンツ修正はここだけを編集する。**
2. **ビルド** — `site/build.js` が Markdown を構造化 JSON に変換し `site/js/data.js`（`window.UXDATA`）を生成。**`site/js/data.js` は生成物なので直接編集しない。**
3. **アプリ** — `site/js/app.js` がバニラ JS の SPA として `window.UXDATA` を読み、各画面（読む／単語カード／問題演習／検索／計画・資料）を描画。

`docs/*.md` を編集したら必ず `node site/build.js` を実行して `data.js` を反映する。

### build.js が依存する Markdown 規約

`ux_kentei_basic_hcd_study_guide.md` は見出しの番号・書式で機械的にパースされるため、構造を崩さないこと。

- H1 `# N. ...` の番号で大セクションを識別（`3.` 本編、`4.` 重要語句集、`7.` 模擬問題100問 など）。
- 本編の章は `## 第N章 タイトル`、章内は `### N. ...`（1〜7 が理解／概念／関連／実践／落とし穴／ミニ問題／メモに対応）。
- 模擬問題は `## 問N　[カテゴリ]`。問題ブロックは `**QN. 問題文**` → `A.`〜`D.` → `正解: **X**` → `解説:` → `不正解選択肢の理由:` の形式。
- 用語集は `## 用語名` の下に `- 一言定義:` などのフィールド。

### ビルド時の検証（満たさないとエラー）

章数9・各章ミニ問題5問・模擬問題100問・用語集110語以上、各問の4択／正解／解説／不正解理由の整合、ID・問題文の重複、正解位置の分布、`syllabus_keywords.json` の構造とA優先語句の教材内対応。

## 注意点

- 試験の回・日程・受験料などは `site/js/app.js` の `EXAM_INFO` にハードコードされており、docs とは別に更新が必要。
- 模擬問題はすべてオリジナルで公式問題ではない。合格基準・出題割合は公式非公表なので断定しない。
- `main` への push で `.github/workflows/deploy.yml` が `node site/build.js` を実行し、`site/` のみを GitHub Pages に公開する。
