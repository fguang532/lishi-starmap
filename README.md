# 华夏星图

以三维星图探索中国历史。中文内容覆盖文明起源至1912年清帝退位，分为22个专题。每个专题包含概览、精选人物／事件／制度／文化／遗址／政权节点，以及带来源的关系。

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
- `components/history/Explorer.tsx`：导航、历史栈、索引及响应式状态。
- `components/history/StarScene.tsx`：三维布局、粒子、镜头转场和交互。
- `components/history/DetailPanel.tsx`：历史详情与资料来源。
- `components/history/FlatGraph.tsx`：二维降级视图。
- `app/globals.css`：颜色、字体、布局及手机适配。

专题用于阅读导航，时间允许重叠。不得根据专题顺序生成“取代”关系。传说、约年、争议结论应在节点certainty、日期和正文中明确。引用来源应指向可核验的相关页面。页面呈现精选内容，不是完整史料库。

## 交互

鼠标拖动旋转，滚轮缩放；触屏单指旋转、双指缩放。点击时期进入内部关系网，点击节点展开详情，再通过相关节点继续阅读。“返回”恢复上一次浏览状态与镜头位置，“文明全景”返回全局。历史索引和时间轴均可通过键盘访问。

动效支持暂停，并自动遵循系统“减少动态效果”偏好；页面隐藏时停止绘制。WebGL 2 不可用或上下文丢失时自动切换二维视图。全部内容保存在项目内，无需内容数据库或第三方API密钥。

## 发布与源码

项目基于 Sites 的 React 19 / TypeScript / Vinext 模板，三维部分使用 Three.js 和 React Three Fiber 9。Sites配置位于`.openai/hosting.json`。此版本默认私有，访问范围由Sites管理。项目不包含账户密码、发布凭证或API密钥。
