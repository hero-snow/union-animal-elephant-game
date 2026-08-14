# 動物合体ゲーム (Union Animal Game)

Phaser 3, Matter.js, Vite, および TypeScript で構築された 2D 物理パズルゲームです。  
落とした動物同士を合体（進化）させてスコアを伸ばし、最上位の「ぞう」を目指します。

---

## 🎮 ゲーム概要と操作方法

1. **動物を落とす**: マウスの移動（またはタッチ操作）で位置を合わせ、クリックで動物を落下させます。
2. **合体（進化）**: 同じ種類の動物同士が接触すると、ワンランク上の大きな動物へと進化し、得点が加算されます。
3. **ゲームオーバー**: 箱の上部にある判定ラインを動物が一定時間越え続けるとゲームオーバーになります。

### 🐾 動物の進化チェーン

| 段階 | 名前 | 半径(px) | 得点 |
|:---:|:---:|:---:|:---:|
| 1 | ねずみ | 30 | 10 |
| 2 | うさぎ | 40 | 20 |
| 3 | ねこ | 60 | 30 |
| 4 | いぬ | 70 | 40 |
| 5 | きつね | 80 | 50 |
| 6 | うま | 100 | 60 |
| 7 | きりん | 120 | 70 |
| 8 | ライオン | 140 | 80 |
| 9 | ぞう | 160 | 90 |

---

## ⚡ 技術的特徴（凹形状の物理計算再現）

従来の物理判定（単純な円や凸包 / Convex Hull）では、うさぎの耳の間やキリンの首回り、象の鼻の曲がりといった「凹み（Concave）」が平坦化されてしまっていました。  
本ゲームでは以下のアルゴリズムを組み合わせることで、**動物画像の特徴的な凹形状をリアルに反映した物理判定**を実現しています。

1. **Moore-Neighbor 輪郭抽出アルゴリズム**: スプライト画像（アルファチャンネル）の外郭を8方向近傍追跡し、正確な境界頂点列を取得。
2. **Ramer-Douglas-Peucker (RDP) ポリゴン削減**: 密な画素列から凹凸特徴を維持しつつ15〜30頂点程度に最適化。
3. **`poly-decomp` による凹多角形の分解**: 凹多角形を Matter.js 上で複合凸ボディ（Compound Body）へ自動分解。
4. **重心とテクスチャ原点の同期**: Matter.js が算出する真の重心（Center of Mass）にスプライトの原点（Origin）を完璧にアタッチ。

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) をご参照ください。

---

## 🛠️ 技術スタック

- **Game Engine**: [Phaser 3](https://phaser.io/) (v3.90+)
- **Physics Engine**: Matter.js (`poly-decomp` による凹分解)
- **Bundler & Tooling**: [Vite](https://vitejs.dev/) (v8+)
- **Language**: TypeScript (v7+)

---

## 🚀 開発とビルド手順

### 動作環境
- [Node.js](https://nodejs.org) (v18+)

### コマンド一覧

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動 (http://localhost:8080)
npm run dev-nolog

# プロダクションビルド (dist/ フォルダへ出力)
npm run build-nolog

# GitHub Pages へのデプロイ
npm run deploy
```

---

## 🌐 GitHub Pages デプロイ

本プロジェクトは GitHub Pages に対応しています。

### 手動デプロイ
`npm run deploy` コマンドを実行すると、`dist/` 成果物が自動的に `gh-pages` ブランチにプッシュされます。

### 自動デプロイ (GitHub Actions)
`.github/workflows/deploy.yml` により、`main` ブランチへ Push または PR がマージされると自動的にビルド＆デプロイが実行されます。

---

## 📜 ライセンス (License)

本リポジトリはコードと画像アセットでライセンスが異なります。

### プログラムコード
- **ライセンス**: [MIT License](LICENSE)
- **著作者**: **Hiroyuki Oikawa**

### 画像アセット (`public/assets/` / `public/assets/images/`)
- **ライセンス**: **All Rights Reserved** (許諾要)
- **著作権者**: **Hiroyuki Oikawa の子供たち (Children of Hiroyuki Oikawa)**
- ※画像アセットの無断転載、複製、再配布、商業利用は禁止されています。利用には著作権者の事前許諾が必要です。
