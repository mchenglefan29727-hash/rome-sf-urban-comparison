
## Correctness patch

This build fixes five issues reported after the Style Lab version:

1. The fallback panel no longer sits permanently on top of the live map.
2. San Francisco fallback now uses the San Francisco paper map (and follows A/B/C/D filtering).
3. Progress-bar fills are rendered as block elements so percentage widths are visible.
4. Style switching includes explicit foreground/background contrast rules.
5. Displayed numerical data was audited against `Rome-SF.docx`; see `DATA-AUDIT.md`.

Rome uses a local MapLibre background style so the Roman GeoJSON layer does not depend on a remote basemap style just to initialize. San Francisco vector geometry still requires the external Mapping Inequality source; when it is unavailable the correct SF paper map is shown.

## V5 设计原则

- 不因为接入 GIS 改变整站视觉风格。
- 保留 V3 的米白背景、卡片、字体层级、三栏 Explore 布局、按钮与图表风格。
- GIS 只替换原来的地图图片/Marker 交互层。

# Rome × San Francisco — Urban Inequality Atlas GIS (V5)

这是保留 V3 原有视觉风格、仅把地图层升级为 GIS 的版本。

## 这版真正变成了什么

### Rome
- 使用 MapLibre GL JS 真实地图容器。
- 14 个行政区已转换为 GeoJSON Polygon，可点击整个区域、悬浮、高亮、缩放。
- 区域评分、Positive/Negative 数量、面积、Normalized Score、Size-Agnostic Grade 来自上传论文表格。
- Scoring method 切换会同时改变：
  1. Rome 区域着色；
  2. 当前 Grade；
  3. Regional ranking。
- Interpretive lens 仅在 Rome 出现。
- `Positive density / Negative density` 会按区域密度重新着色。

> 重要：论文 DOCX 没有提供 Coarelli 14 区原始 GIS Polygon。
> 当前 `data/rome-regions.geojson` 是依据论文中的 14-region figure 人工数字化，
> 并使用论文给出的 Rome bounding box（41.870–41.915 N，12.460–12.520 E）进行地理配准。
> 因此它是“可交互 GIS Polygon”，但边界精度属于展示/研究原型级，不应作为测绘级边界。

### San Francisco
- Explore 不再使用 A/B/C/D 静态图片作为主地图。
- 直接通过 PMTiles 加载 Mapping Inequality 的 HOLC vector polygons。
- 每个 HOLC 区域可以 Hover / Click。
- 支持 A/B/C/D 过滤。
- San Francisco 模式不会显示 Rome 的 Interpretive lens 或 Regional investment ranking。

## Compare
- Rome 与 San Francisco 两张真实地图并排。
- A/B/C/D 可同步筛选。
- Rome 可以在 Normalized 与 Size-Agnostic 两套模型之间切换。

## 数据来源

### 用户上传论文
`Rome-SF.docx`
用于：
- Rome 14-region 参考图；
- Rome bounding box；
- Rome 区域评分表；
- San Francisco / Rome 比较数据；
- 研究方法和区域说明。

### San Francisco vector data
Mapping Inequality / Digital Scholarship Lab  
https://dsl.richmond.edu/panorama/redlining/

本项目使用公开 PMTiles：
https://s3-west.nrp-nautilus.io/public-mappinginequality/mappinginequality.pmtiles

请注意 Mapping Inequality 数据许可条款，当前来源标注为 CC BY-NC-SA 4.0 / 非商业研究展示场景应保留署名。

### Basemap
OpenFreeMap Liberty style  
https://tiles.openfreemap.org/styles/liberty

### Pleiades
Pleiades 提供 GIS-ready 数据和代表点坐标：
https://pleiades.stoa.org/downloads

论文提到其 Rome 工作集最初筛选得到 383 个候选地点，但上传 DOCX 并未附带这 383 行原始数据。
因此 V4 没有伪造这些 POI。后续拿到论文实际 Pleiades 工作表后，可直接增加为真实点图层。

## 文件结构

```text
rome-sf-site-v4/
├─ index.html
├─ styles.css
├─ app.js
├─ start-server.bat
├─ start-server.sh
├─ assets/
│  ├─ rome-regions.png
│  ├─ rome-regions-cropped.png
│  ├─ rome-bounds.png
│  └─ sf-*.png
└─ data/
   ├─ rome-regions.geojson
   ├─ rome-region-labels.geojson
   └─ rome-regions.js
```

`rome-regions.js` 是 GeoJSON 的浏览器内嵌版本，目的是让页面即使从 `file://` 打开也无需 fetch 本地 JSON。

## 如何运行

最简单：
1. 解压 ZIP；
2. 双击 `index.html`；
3. 保持联网。

更推荐在目录中运行本地 HTTP 服务：

Windows：
```bat
start-server.bat
```

macOS / Linux：
```bash
./start-server.sh
```

然后打开：
http://127.0.0.1:8787/

也可以手动：
```bash
python -m http.server 8787
```

## 后续最值得继续做

1. 拿到论文实际使用的 383 条 Pleiades 数据，加入真实 POI 图层；
2. 若能取得权威的 Augustan Rome 14-region GIS 边界，用其替换当前人工数字化 GeoJSON；
3. 为 SF 96 个区域加载 HOLC area description 长文本；
4. 增加时间轴与筛选统计；
5. 将 Compare 的地图视角、Grade、POI 类型联动。

## Style Lab fixed package
This package is built from the complete V5 distribution. It includes all original assets, GIS data files, and local launch scripts, with the Style Lab HTML/CSS/JS layered on top.
