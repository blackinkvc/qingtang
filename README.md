# 青棠宗 · 拾茧

线上地址：https://blackinkvc.github.io/qingtang/

一个修仙题材的**开箱模拟器**：网道崩溃之后，你是青棠宗的「拾茧人」——巡视时空裂缝，捡回渗出物凝成的「茧」，鉴定、开壳，再决定上交宗门还是私藏。配套还有宗门档案、关系网、真实地形地图与灵植园偷菜小游戏。

全部页面是纯静态单文件 HTML，零依赖、零构建，浏览器直接打开即可玩。

## 怎么玩

1. 打开 [线上地址](https://blackinkvc.github.io/qingtang/)，点「▶ 开始游戏 · 拾茧」。
2. **巡视裂缝**：选区域推进一回合，回复神识并补 1–3 枚茧。
3. **上台开茧**：点队列里的茧 → 神识鉴定（会看错）→ 一叩壳 / 二听息 / 三启封。
4. **做决策**：上交宗门换贡献、私藏进密库、凑完器、放归活人、封存销毁。
5. **两条死线**：魔染 ≥ 100 你会变成茧中物；宗门察觉 ≥ 100 会被清查罚没。
6. **灵植园**：页头「灵植园」按钮进入，按真实时间种菜，可去同门菜地偷菜，也会被偷。
7. 进度存在浏览器 `localStorage`（键名 `qingtang_cocoon_v1`），支持导出 / 导入带校验的存档。

## 页面结构

| 页面 | 说明 |
| --- | --- |
| `index.html` | 看板与导航（入口） |
| `cocoon.html` | 游戏本体：拾茧 · 开箱模拟器（含灵植园偷菜） |
| `roster.html` | 仙人活档（1011 人、外神 / 魔染模拟） |
| `relationship-map.html` | 六类关系网（师徒 / 同门 / 上下级 / 道侣 / 跨门 / 仇敌） |
| `sect-map-real.html` | 离线地图：平面地形 / 3D 地形 / 哥特大理石 / 真实建筑 / 实景全景 |
| `sect-map.html` | 旧 2D 宗门地图 |
| `mortal.html` | 凡人群体模型 |
| `sect-sim.html` | 经济结构模型 |
| `sect-life.html` | 旧版轮回玩法（背景资料） |
| `wardrobe.html` | 服饰素材库 |
| `portraits.html` | 立绘画廊 |
| `avatars.js` | 125 人头像映射、旧立绘回退、人物设定元数据 |
| `avatars/` | 125 张专属头像（512×512 WebP）+ 生图提示词册 |
| `portraits/` | 35 张立绘与概念图（WebP），兼作头像回退 |
| `clothes/` | 10 张服饰素材 |
| `vendor/` | three.min.js、OrbitControls.js（离线 3D 引擎） |

## 素材与发布说明

- 为适配 GitHub Pages，头像由原始 768×768 PNG 转为 **512×512 WebP（质量 82）**，立绘转为最长边 1024 的 WebP，`avatars.js` 的 `window.AVATARS` 结构与人物 id 完全不变，仅路径扩展名改为 `.webp`。
- 全部素材本地化，页面运行时**不请求任何 CDN 或在线瓦片**。
- 本地预览：直接双击 `index.html`，或用任意静态服务器（如 `python -m http.server`）打开仓库根目录。

## 文档

- `GAME-DESIGN.md`：设计大纲、工作日志、文件清单
- `WORLD-LORE.md`：纪元史、青棠宗史、网道与大崩溃
- `WORLD-BOOKS.md`：112 本典籍 / 28 行业
- `sect-design.md`：宗门地理词条
- `building-prompts.md`：建筑生图提示词
