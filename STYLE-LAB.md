# Rome × San Francisco — V5 Style Lab

本版本严格基于 V5 功能与布局继续扩展，不修改 GIS 数据、评分逻辑或交互逻辑。

## 新增：5 种视觉风格

1. **Classic Research**
   - V5 原始风格
   - 米白、学术、研究型
   - 适合论文网站 / 答辩

2. **Historical Archive**
   - 羊皮纸暖色
   - 酒红 + 黄铜色
   - 更像历史档案馆、古地图册

3. **Museum Exhibit**
   - 极简白色
   - 更大的标题与留白
   - 细线、无阴影、展览图录感
   - 适合公开展示 / 展厅屏幕

4. **Data Lab**
   - 冷灰蓝
   - 更现代、更偏 GIS / 数据分析工作台
   - 无衬线字体 + dashboard 感

5. **Night Cartography**
   - 深蓝黑夜间地图
   - 米金 + 青绿色数据强调
   - 更适合大屏、演示、沉浸式地图展示

点击顶部 **View style** 可即时切换，选择会保存在浏览器 localStorage 中。

## 新增：3 种 Explore 展示方式

- **Standard**
  - 完全保留 V5 的三栏结构

- **Map Focus**
  - 中间 GIS 地图更宽、更高
  - 左右面板略缩
  - 适合地图探索和现场讲解

- **Exhibit**
  - 地图作为主体
  - Region Detail 移到底部横向展示
  - 隐藏 Rome reference image
  - 适合展览 / 大屏 / presentation

视觉风格和布局方式可以自由组合，例如：
- Historical Archive + Exhibit
- Data Lab + Map Focus
- Night Cartography + Map Focus
- Classic Research + Standard

## 核心原则

这些模式只改变表现层，不改变：
- Rome 14 个 GeoJSON Polygon
- San Francisco HOLC Vector Polygon
- Scoring method
- Interpretive lens
- Grade filtering
- Region ranking
- Compare / Story / Methodology 功能

