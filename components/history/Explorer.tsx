"use client";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Compass,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Move,
  MousePointer2,
  Layers3,
  ChevronLeft,
  BookOpen,
  X,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { eras as curatedEras } from "@/data/eras";
import type { CameraPose, Era, HistoryNode, ViewState } from "@/data/types";
import { eraColor, TYPE_COLORS } from "@/data/types";
import DetailPanel from "./DetailPanel";
import FlatGraph from "./FlatGraph";
import DayGallery from "./DayGallery";
import Preferences from "./Preferences";
import {
  TAG_LABELS,
  matchesInterest,
  sortedEras,
  sortedNodes,
  type SortMode,
} from "@/data/exploration";
import type { ThemeMode } from "@/data/types";
const StarScene = lazy(() => import("./StarScene"));
class SceneBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Control({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button aria-label={label} aria-pressed={pressed} onClick={onClick}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="control-tooltip">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
const ROOT: ViewState = { eraId: null, nodeId: null };
export default function Explorer() {
  const [eras, setEras] = useState<Era[]>(curatedEras);
  const [libraryStatus, setLibraryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [libraryRetry, setLibraryRetry] = useState(0);
  const [pageChoice, setPageChoice] = useState({ key: "", page: 0 });
  const [view, setView] = useState<ViewState>(ROOT);
  const [panelOpen, setPanelOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("night");
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("chronological");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [flat, setFlat] = useState(false);
  const [reset, setReset] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [restore, setRestore] = useState<CameraPose | null>(null);
  const history = useRef<{ view: ViewState; pose: CameraPose | null; pageChoice: { key: string; page: number } }[]>([]);
  const pose = useRef<CameraPose | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const allNodes = useMemo(
    () =>
      new Map<string, { node: HistoryNode; era: Era }>(
        eras.flatMap((e) =>
          e.nodes.map((n) => [n.id, { node: n, era: e }] as const),
        ),
      ),
    [eras],
  );
  const allRelations = useMemo(() => eras.flatMap((e) => e.relations), [eras]);
  const era = eras.find((e) => e.id === view.eraId);
  const node = view.nodeId ? allNodes.get(view.nodeId)?.node : undefined;
  const totalNodes = allNodes.size;
  const is3D = theme === "night" && webgl === true && !flat;
  const motionStopped = paused || reduced;
  const matchingIds = useMemo(
    () =>
      tags.length
        ? eras.flatMap((e) =>
            e.nodes.filter((n) => matchesInterest(n, tags)).map((n) => n.id),
          )
        : null,
    [eras, tags],
  );
  const filteredEras = useMemo(
    () => sortedEras(eras, tags, sort),
    [eras, tags, sort],
  );
  const filteredNodes = era ? sortedNodes(era.nodes, tags, sort) : [];
  const pageKey = `${view.eraId}:${tags.join(",")}:${sort}`;
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredNodes.length / pageSize));
  const selectedPage = node ? Math.floor(filteredNodes.findIndex(n => n.id === node.id) / pageSize) : -1;
  const graphPage = Math.min(pageCount - 1, pageChoice.key === pageKey ? pageChoice.page : Math.max(0, selectedPage));
  const sceneEras = useMemo(() => {
    if (!era) return eras;
    const nodes = sortedNodes(era.nodes, tags, sort).slice(graphPage * pageSize, (graphPage + 1) * pageSize);
    if (node && !nodes.some(n => n.id === node.id)) nodes.push(node);
    return eras.map(e => e.id === era.id ? { ...e, nodes } : e);
  }, [eras, era, tags, sort, graphPage, node]);
  useEffect(() => {
    const controller = new AbortController();
    setLibraryStatus("loading");
    fetch("/library/exploration.json", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("学堂档案载入失败"); return response.json(); })
      .then(raw => {
        const value = raw as Era[];
        if (!Array.isArray(value) || value.length !== curatedEras.length) throw new Error("学堂目录不完整");
        if (!controller.signal.aborted) { setEras(value); setLibraryStatus("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setLibraryStatus("error"); });
    return () => controller.abort();
  }, [libraryRetry]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("huaxia-exploration-v2") || "null",
      );
      if (saved) {
        if (saved.theme === "day" || saved.theme === "night")
          setTheme(saved.theme);
        if (Array.isArray(saved.tags))
          setTags([
            ...new Set<string>(
              saved.tags.filter(
                (t: unknown) => typeof t === "string" && t in TAG_LABELS,
              ),
            ),
          ]);
        if (["chronological", "reverse", "relevance"].includes(saved.sort))
          setSort(saved.sort);
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "night");
    if (preferencesLoaded) {
      try {
        localStorage.setItem(
          "huaxia-exploration-v2",
          JSON.stringify({ theme, tags, sort }),
        );
      } catch {
        /* Preferences still work in memory. */
      }
    }
  }, [theme, tags, sort, preferencesLoaded]);
  useEffect(() => {
    const small = window.matchMedia("(max-width: 767px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSize = () => setMobile(small.matches);
    const updateMotion = () => setReduced(motion.matches);
    const updateVisible = () => setVisible(!document.hidden);
    updateSize();
    updateMotion();
    updateVisible();
    small.addEventListener("change", updateSize);
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisible);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setWebgl(!!gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }
    return () => {
      small.removeEventListener("change", updateSize);
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisible);
    };
  }, []);
  useEffect(() => {
    if (!view.eraId) {
      timelineRef.current?.scrollTo({
        left: 0,
        behavior: motionStopped ? "instant" : "smooth",
      });
      return;
    }
    timelineRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({
        behavior: motionStopped ? "instant" : "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [view.eraId, motionStopped]);
  const navigate = useCallback(
    (next: ViewState) => {
      if (next.eraId === view.eraId && next.nodeId === view.nodeId) {
        setPanelOpen(!!next.eraId);
        return;
      }
      history.current.push({
        view,
        pageChoice: { key: pageKey, page: graphPage },
        pose: pose.current
          ? {
              position: [...pose.current.position],
              target: [...pose.current.target],
            }
          : null,
      });
      setRestore(null);
      setView(next);
      setPanelOpen(!!next.eraId);
      setReset((n) => n + 1);
      setIndexOpen(false);
    },
    [view, pageKey, graphPage],
  );
  const goEra = useCallback(
    (id: string) => navigate({ eraId: id, nodeId: null }),
    [navigate],
  );
  const goNode = useCallback(
    (id: string) => {
      const entry = allNodes.get(id);
      if (entry) {
        setPageChoice({ key: "", page: 0 });
        navigate({ eraId: entry.era.id, nodeId: id });
      }
      else if (eras.some((e) => e.id === id)) goEra(id);
    },
    [allNodes, navigate, goEra],
  );
  const goBack = useCallback(() => {
    setPageChoice({ key: "", page: 0 });
    const prev = history.current.pop();
    if (prev) {
      setPageChoice(prev.pageChoice);
      setView(prev.view);
      setRestore(prev.pose);
      setPanelOpen(!!prev.view.eraId);
      setReset((n) => n + 1);
    } else {
      setView(ROOT);
      setRestore(null);
      setPanelOpen(false);
      setReset((n) => n + 1);
    }
  }, []);
  const goGlobal = useCallback(() => {
    if (view.eraId) navigate(ROOT);
    else {
      setRestore(null);
      setReset((n) => n + 1);
    }
  }, [view.eraId, navigate]);
  const changeGraphPage = (page: number) => {
    if (node && era) {
      navigate({ eraId: era.id, nodeId: null });
      setPanelOpen(false);
    }
    setPageChoice({ key: pageKey, page });
  };
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !panelOpen &&
        !indexOpen &&
        !preferencesOpen &&
        view.eraId
      ) {
        goBack();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [goBack, panelOpen, indexOpen, preferencesOpen, view.eraId]);
  const onPose = useCallback((p: CameraPose) => {
    pose.current = p;
  }, []);
  const onSceneError = useCallback(() => setWebgl(false), []);
  const selectedIndex = era ? eras.indexOf(era) : -1;
  return (
    <TooltipProvider delayDuration={200}>
      <main
        data-preferences-ready={preferencesLoaded}
        className={`atlas-app theme-${theme} ${era ? "has-selection" : ""} ${panelOpen && !mobile ? "panel-visible" : ""} ${motionStopped ? "motion-paused" : ""}`}
      >
        <header className="topbar">
          <button
            className="brand"
            onClick={goGlobal}
            aria-label="华夏星图，回到全局"
          >
            <span className="brand-orbit">
              <Orbit size={31} />
            </span>
            <span>
              <strong>华夏星图</strong>
              <small>CHRONICLES OF CHINA</small>
            </span>
          </button>
          <nav className="main-nav" aria-label="主导航">
            <a href="/learn" className="learning-nav-link">系统学习</a>
            <button className={!era ? "active" : ""} onClick={goGlobal}>
              文明全景
            </button>
            <button
              className={indexOpen ? "active" : ""}
              onClick={() => setIndexOpen(true)}
            >
              历史索引
            </button>
          </nav>
          <div className="country-label">
            <button
              className={`preferences-trigger ${tags.length ? "has-preferences" : ""}`}
              onClick={() => setPreferencesOpen(true)}
              aria-label="探索偏好"
            >
              <SlidersHorizontal size={16} />
              <span>探索偏好</span>
              {tags.length > 0 && <b>{tags.length}</b>}
            </button>
            <button
              className="theme-toggle"
              disabled={!preferencesLoaded}
              onClick={() => setTheme((t) => (t === "night" ? "day" : "night"))}
              aria-label={
                theme === "night" ? "切换白天古风模式" : "切换夜间星图模式"
              }
            >
              {theme === "night" ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === "night" ? "宫阙日景" : "星河夜景"}</span>
            </button>
          </div>
        </header>
        <section className="universe" aria-label="中国历史交互星图">
          {libraryStatus !== "ready" && (
            <div className="academy-status" role="status">
              {libraryStatus === "loading" ? "正在载入历史学堂的完整档案…" : "完整档案未载入，当前仅显示精选内容。"}
              {libraryStatus === "error" && <button onClick={() => setLibraryRetry(n => n + 1)}>重新载入</button>}
            </div>
          )}
          {theme === "day" ? (
            <DayGallery
              eras={eras}
              era={era}
              node={node}
              tags={tags}
              sort={sort}
              onEra={goEra}
              onNode={goNode}
              onGlobal={goGlobal}
              onPreferences={() => setPreferencesOpen(true)}
              onOverview={() => {
                if (node && era) goEra(era.id);
                else setPanelOpen(true);
              }}
              onClear={() => setTags([])}
            />
          ) : (
            <>
              <div className="scene-holder" data-testid="star-scene">
                {is3D ? (
                  <SceneBoundary onError={onSceneError}>
                    <Suspense
                      fallback={
                        <FlatGraph
                          eras={sceneEras}
                          eraId={view.eraId}
                          nodeId={view.nodeId}
                          onEra={goEra}
                          onNode={goNode}
                          matchingIds={matchingIds}
                        />
                      }
                    >
                      <StarScene
                        eras={sceneEras}
                        eraId={view.eraId}
                        nodeId={view.nodeId}
                        paused={paused}
                        reduced={reduced}
                        reset={reset}
                        zoom={zoom}
                        restore={restore}
                        mobile={mobile}
                        visible={visible}
                        onPose={onPose}
                        onError={onSceneError}
                        onEra={goEra}
                        onNode={goNode}
                        matchingIds={matchingIds}
                      />
                    </Suspense>
                  </SceneBoundary>
                ) : (
                  <FlatGraph
                    eras={sceneEras}
                    eraId={view.eraId}
                    nodeId={view.nodeId}
                    onEra={goEra}
                    onNode={goNode}
                    matchingIds={matchingIds}
                  />
                )}
              </div>
            </>
          )}
          {theme === "night" && (
            <>
              <div className="universe-heading">
                <span className="eyebrow">
                  <span className="status-light" /> CHINA THROUGH TIME
                </span>
                {era ? (
                  <>
                    <div className="explore-breadcrumb">
                      <button className="back-link" onClick={goBack}>
                        <ChevronLeft size={15} />
                        返回
                      </button>
                      <span>/</span>
                      <button onClick={goGlobal}>文明全景</button>
                      {node && (
                        <>
                          <span>/</span>
                          <button onClick={() => goEra(era.id)}>
                            {era.shortTitle}
                          </button>
                        </>
                      )}
                    </div>
                    <h1>{era.title}</h1>
                    <p>
                      {era.dateLabel}
                      <br />
                      <span className="era-kicker">{era.kicker}</span>
                    </p>
                    <button
                      className="read-overview"
                      onClick={() => {
                        if (node) goEra(era.id);
                        else setPanelOpen(true);
                      }}
                    >
                      <BookOpen size={14} />
                      {node
                        ? "阅读时期概览"
                        : panelOpen
                          ? "时期概览"
                          : "展开时期概览"}
                    </button>
                  </>
                ) : (
                  <>
                    <h1>
                      穿行五千年<span>探索文明的轨迹</span>
                    </h1>
                    <p>
                      从文明初曙，到帝制终章。
                      <br />
                      每一个节点，都是一段历史的入口。
                    </p>
                    <div className="overview-stats">
                      <span>
                        <b>22</b>历史专题
                      </span>
                      <i />
                      <span>
                        <b>{totalNodes}</b>历史入口
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="stage-index">
                <span>{era ? "当前历史专题" : "中国历史 · 精选专题"}</span>
                <strong>
                  {String(era ? selectedIndex + 1 : 22).padStart(2, "0")}
                  <i>/ 22</i>
                </strong>
                {era && <span className="era-english">{era.englishTitle}</span>}
              </div>
              {era && (
                <div className="graph-legend" aria-label="节点类型">
                  {[...new Set(era.nodes.map((n) => n.type))].map((t) => (
                    <span key={t}>
                      <i style={{ background: TYPE_COLORS[t] }} />
                      {t}
                    </span>
                  ))}
                  <span className="edge-legend">
                    <i />
                    有据关系
                  </span>
                </div>
              )}
              {era && pageCount > 1 && (
                <nav className="graph-pagination" aria-label="星图节点分页">
                  <button aria-label="上一组节点" disabled={graphPage === 0} onClick={() => changeGraphPage(graphPage - 1)}>上一组</button>
                  <span>{graphPage + 1} / {pageCount} · 共 {filteredNodes.length} 个节点</span>
                  <button aria-label="下一组节点" disabled={graphPage === pageCount - 1} onClick={() => changeGraphPage(graphPage + 1)}>下一组</button>
                  <button onClick={() => { if (node) goEra(era.id); else setPanelOpen(true); }}>完整名单</button>
                </nav>
              )}
              {tags.length > 0 && (
                <div className="active-preferences">
                  <button onClick={() => setPreferencesOpen(true)}>
                    <SlidersHorizontal size={14} />
                    {tags
                      .slice(0, 2)
                      .map((t) => TAG_LABELS[t])
                      .join(" · ")}
                    {tags.length > 2 ? ` 等 ${tags.length} 项` : ""}
                    <span>
                      {era ? filteredNodes.length : matchingIds?.length} 个匹配
                    </span>
                  </button>
                  <button aria-label="清除所有筛选" onClick={() => setTags([])}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {era &&
                tags.length > 0 &&
                filteredNodes.length === 0 &&
                !node && (
                  <div className="night-empty">
                    <p>这一时期暂未收录所选类别</p>
                    <button onClick={() => setTags([])}>显示全部节点</button>
                  </div>
                )}
              {webgl === false && (
                <p className="fallback-notice" role="status">
                  当前使用二维星图，历史内容完整可读。
                </p>
              )}
              <div className="scene-bottom">
                <div className="gesture-help">
                  {is3D ? (
                    <>
                      <span>
                        <Move size={14} />
                        {mobile ? "单指旋转" : "拖动旋转"}
                      </span>
                      <span>
                        <MousePointer2 size={14} />
                        {mobile ? "双指缩放" : "点击探索"}
                      </span>
                      <span className="desktop-only">滚轮缩放</span>
                    </>
                  ) : (
                    <span>
                      <MousePointer2 size={14} />
                      点击节点探索
                    </span>
                  )}
                </div>
                <div className="scene-controls">
                  {is3D && (
                    <>
                      <Control
                        label="放大星图"
                        onClick={() => setZoom((z) => z + 1)}
                      >
                        <ZoomIn size={17} />
                      </Control>
                      <Control
                        label="缩小星图"
                        onClick={() => setZoom((z) => z - 1)}
                      >
                        <ZoomOut size={17} />
                      </Control>
                    </>
                  )}
                  <Control
                    label={
                      reduced
                        ? "系统已启用减少动态效果"
                        : paused
                          ? "播放动效"
                          : "暂停动效"
                    }
                    pressed={motionStopped}
                    onClick={() => setPaused((p) => !p)}
                  >
                    {motionStopped ? <Play size={17} /> : <Pause size={17} />}
                  </Control>
                  <Control
                    label="重置视角"
                    onClick={() => {
                      setRestore(null);
                      setReset((n) => n + 1);
                    }}
                  >
                    <RotateCcw size={17} />
                  </Control>
                  <button
                    className="dimension-tag"
                    aria-label={is3D ? "切换二维视图" : "切换三维视图"}
                    disabled={webgl === false}
                    onClick={() => setFlat((f) => !f)}
                  >
                    {is3D ? "3D" : "2D"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <footer className="chronology">
          <div className="chronology-top">
            <span>
              <Layers3 size={15} />
              历史长河 <small>THE TIMELINE</small>
            </span>
            <p>
              文明起源 <i /> 1912年
            </p>
          </div>
          <div
            ref={timelineRef}
            id="timeline"
            className="timeline"
            tabIndex={-1}
            aria-label="选择历史时期"
          >
            {eras.map((e, i) => (
              <button
                key={e.id}
                aria-label={`探索${e.title}`}
                aria-current={view.eraId === e.id ? "true" : undefined}
                style={{ "--era-color": eraColor(i) } as React.CSSProperties}
                className={`timeline-era ${view.eraId === e.id ? "selected" : ""} ${tags.length && !e.nodes.some((n) => matchesInterest(n, tags)) ? "unmatched" : ""}`}
                onClick={() => goEra(e.id)}
              >
                <span className="timeline-dot" />
                <span className="era-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{e.shortTitle}</strong>
              </button>
            ))}
          </div>
        </footer>
        <DetailPanel
          era={era}
          node={node}
          open={panelOpen}
          mobile={mobile}
          relations={allRelations}
          allNodes={allNodes}
          onClose={() => setPanelOpen(false)}
          onNode={goNode}
          onBack={goBack}
          canBack={history.current.length > 0}
          filteredNodes={filteredNodes}
          filterActive={tags.length > 0}
          onClearFilter={() => setTags([])}
        />
        <Preferences
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          tags={tags}
          onTags={setTags}
          sort={sort}
          onSort={setSort}
          eras={eras}
          onEra={goEra}
        />
        <Sheet open={indexOpen} onOpenChange={setIndexOpen}>
          <SheetContent
            side={mobile ? "bottom" : "left"}
            className={`index-panel ${mobile ? "index-panel-mobile" : ""}`}
            showCloseButton={false}
          >
            <div className="index-title-row">
              <div>
                <SheetTitle>历史索引</SheetTitle>
                <SheetDescription>
                  {filteredEras.length} 个专题符合当前偏好。
                </SheetDescription>
              </div>
              <button
                className="panel-icon"
                aria-label="关闭历史索引"
                onClick={() => setIndexOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="era-index-list">
              {filteredEras.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    goEra(e.id);
                    setIndexOpen(false);
                  }}
                  style={
                    {
                      "--era-color": eraColor(eras.indexOf(e)),
                    } as React.CSSProperties
                  }
                  aria-current={view.eraId === e.id ? "true" : undefined}
                >
                  <span>{String(eras.indexOf(e) + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{e.title}</strong>
                    <small>{e.dateLabel}</small>
                  </div>
                  <span className="index-node-count">
                    {e.nodes.filter((n) => matchesInterest(n, tags)).length}{" "}
                    节点
                  </span>
                </button>
              ))}
            </div>
            <p className="index-note">
              专题用于阅读导航，不代表各政权依次存在。并存关系请查看时期内的关系网。
            </p>
          </SheetContent>
        </Sheet>
        <span className="sr-only" role="status" aria-live="polite">
          {node
            ? `正在阅读${node.title}`
            : era
              ? `已进入${era.title}，包含${era.nodes.length}个历史节点`
              : "中国历史全景，22个历史专题"}
        </span>
      </main>
    </TooltipProvider>
  );
}
