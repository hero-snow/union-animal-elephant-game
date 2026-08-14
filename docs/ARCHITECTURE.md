# 動物合体ゲーム システムアーキテクチャ & 物理計算仕様書

本ドキュメントでは、「動物合体ゲーム (Union Animal Game)」のシステム構成、シーン設計、および凹形状物理判定アルゴリズムの技術詳細を解説します。

---

## 1. システム全体構成

```
[ index.html ]
      │
      ▼
[ src/main.ts ]  ---> Phaser.Game インスタンス初期化
      │
      ▼
[ src/game/main.ts ] ---> Phaser 設定 (Vite, Matter.js Physics 連携)
      │
      ▼
[ src/game/scenes/Game.ts ] ---> メインゲームシーン (状態管理, 描画, 物理計算)
```

---

## 2. 凹形状（Concave Polygon）物理判定システム

### 課題背景
通常、2D物理エンジン（Matter.js等）で任意形状の単一ボディを生成する際、標準では**凸包（Convex Hull）**処理が行われます。  
これにより、動物特有の形状（うさぎの耳の隙間、キリンの首回り、象の鼻）の凹み部分が平坦な多角形で塞がれてしまい、隙間に他の動物が挟まるようなリアルな物理挙動が再現できませんでした。

---

### アルゴリズムパイプライン

```
[ スプライト画像 (PNG) ]
           │
           ▼
[ 1. アルファ透過追跡 ] (alpha > 50 の輪郭ピクセル判定)
           │
           ▼
[ 2. Moore-Neighbor 8方向輪郭抽出 ] ──> 境界の一巡点列 Point[] 取得
           │
           ▼
[ 3. Ramer-Douglas-Peucker (RDP) ] ──> 特徴を残し15〜30頂点に削減
           │
           ▼
[ 4. poly-decomp 複合分解 ] ──> 複数の凸多角形 (Compound Body) 生成
           │
           ▼
[ 5. Vertices.centre 重心計算 ] ──> スプライトの SetOrigin(x, y) 同期
```

#### Step 1 & 2: Moore-Neighbor 8方向輪郭追跡 (`extractOutlinePoints`)
スプライト画像の `CanvasRenderingContext2D` から RGBA ピクセル配列を取得し、左上から走査して最初の非透過ピクセルを検索します。  
そこから時計回りに隣接する8方向のピクセルをチェックし、透過境界を辿って一巡するまで巡回トラバースします。

#### Step 3: RDP 多角形簡略化 (`simplifyPolygonRDP`)
輪郭追跡で得られた数百点の高密度頂点を、Ramer-Douglas-Peucker アルゴリズムで簡略化します。  
始点と終点を結ぶ線分からの距離が指定閾値（`epsilon = 3.0`）以上の頂点を重要な特徴点（耳の頂点、首の湾曲部など）として残します。

#### Step 4 & 5: `poly-decomp` 分解と重心同期 (`createAnimal`)
`Matter.Bodies.fromVertices()` に凹多角形頂点配列を渡すと、`poly-decomp` ライブラリ（Bayazit アルゴリズム）が起動し、凹多角形を複数の凸多角形パーツへと分解し、Matter の `Compound Body` を生成します。  
`Matter.Vertices.centre(scaledVertices)` で全体の真の重心を算出し、`image.setOrigin(centre.x / width, centre.y / height)` を設定することで、テクスチャ画像と物理パーツ群がズレなく同期します。

---

## 3. シーンとルール管理

- **落下インジケーター**: マウス座標 (`pointermove`) に応じて上部に表示され、`Phaser.Math.Clamp` により表示領域内に制限。
- **合体（進化）検知**: `matter.world.on('collisionstart')` イベントで同一ラベルのボディ接触を判定。同種動物なら消滅後、中間位置 `(x1+x2)/2, (y1+y2)/2` に上位の動物を生成。
- **ゲームオーバー判定**: `update()` ループにて、ライン `GAME_OVER_LINE_Y (100px)` を越えるボディの `minY` を監視。2秒間（`GAME_OVER_DELAY`）越え続けた場合にゲームオーバーを誘発。

---

## 4. 権利と著作権

- **コード**: MIT License (Copyright (c) 2026 Hiroyuki Oikawa)
- **画像**: All Rights Reserved (Copyright (c) 2026 Children of Hiroyuki Oikawa)
