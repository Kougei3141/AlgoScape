# AlgoScape Web Starter

まず Web で公開するための最小構成（PWA + Firebase Functions サンプル）です。

## 速攻公開（鍵を使わない静的サイト）
- Cloudflare Pages or GitHub Pages へ `dist` をデプロイ
- APIキーをフロントに埋めないこと（ユーザー入力方式はOK）

## 鍵を隠す場合（おすすめ）
- Firebase Hosting + Cloud Functions（`functions_sample/`）を使って /api を経由
- `firebase functions:secrets:set GEMINI_API_KEY` で登録

## PWA
- `index_inject_snippet.html` を index.html に差し込む
- `sw.js` の ASSETS を自分のファイルに合わせる

Generated: 2025-09-09T05:12:05.131029Z
