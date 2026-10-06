# 华夏星图

以夜间三维星图和日间古风长卷探索中国历史。中文内容覆盖文明起源至1912年清帝退位，分为22个专题、220个精选节点。每个专题包含概览、真实历史图像、有出处的史间小故事，以及带来源的关系。

## 本地运行

需要 Node.js 22.13 或以上及 npm。

```sh
npm ci
npm run dev
```

浏览器访问终端打印的本地地址（默认 http://127.0.0.1:5173）。

```sh
npm run check:content
npx tsc --noEmit
npm run build
```

## 修改内容

- `data/history.json`：所有专题、历史节点、关系与来源。先编辑此文件，再运行内容检查。
- `data/types.ts`：内容结构与节点颜色。
- `data/exploration.ts`：偏好标签、排序和图像匹配逻辑。
- `data/images.json` 与 `public/history/`：图像元数据、本地图片、断代、署名及许可。
- `data/anecdotes.json`：有依据的小史事，包含证据性质和引用。
- `components/history/Explorer.tsx`：导航、历史栈、索引及响应式状态。
- `components/history/StarScene.tsx`：三维布局、粒子、镜头转场和交互。
- `components/history/DetailPanel.tsx`：历史详情与资料来源。
- `components/history/FlatGraph.tsx`：二维降级视图。
- `components/history/DayGallery.tsx`：日间古风长卷与朝代卡片。
- `components/history/Preferences.tsx`：兴趣筛选和排序。
- `components/history/HeritageImage.tsx`：图像说明、授权和全图查看。
- `app/globals.css`：颜色、字体、布局及手机适配。
- `app/exploration.css`：日间配色、长卷布局、筛选与图像样式。

专题用于阅读导航，时间允许重叠。不得根据专题顺序生成“取代”关系。传说、约年、争议结论应在节点certainty、日期和正文中明确。引用来源应指向可核验的相关页面。页面呈现精选内容，不是完整史料库。

## 交互

鼠标拖动旋转，滚轮缩放；触屏单指旋转、双指缩放。点击时期进入内部关系网，点击节点展开详情，再通过相关节点继续阅读。“返回”恢复上一次浏览状态与镜头位置，“文明全景”返回全局。历史索引和时间轴均可通过键盘访问。

动效支持暂停，并自动遵循系统“减少动态效果”偏好；页面隐藏时停止绘制。WebGL 2 不可用或上下文丢失时自动切换二维视图。全部内容保存在项目内，无需内容数据库或第三方API密钥。

顶栏可以切换“宫阙日景”和“星河夜景”。“探索偏好”分帝王与大臣、大事与战役、名人与诗人、作品与艺术、制度与文明五组，共14个多选标签；选择任意标签即可匹配。专题与阅读列表支持年代正序、逆序及偏好匹配排序；时间轴和关系图的位置保持稳定。沿关系打开筛选外的节点时仍可阅读，并有明确提示。

外观和偏好只保存在当前浏览器的 `huaxia-exploration-v2` localStorage 中。清除浏览器数据会重置偏好；禁止存储时仍可在当前页面使用。

图像来自馆藏开放资源及 Wikimedia Commons，逐项许可见 `data/images.json` 和页面图注。太和殿照片署名 Gisling，许可 CC BY 3.0；页面标明缩略展示可能裁切。历史原物、现代摄影和后世摹本分别标注，不把时期背景图当作具体人物的肖像或遗物。所有本地图片可离线加载，来源链接需要联网。

## 发布与源码

项目基于 Sites 的 React 19 / TypeScript / Vinext 模板，三维部分使用 Three.js 和 React Three Fiber 9。Sites配置位于`.openai/hosting.json`。当前线上访问范围为公开，由Sites管理。项目不包含账户密码、发布凭证或API密钥。
