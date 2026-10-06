"use client";
import "@/app/exploration.css";
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
import {
  ERA_COUNT,
  loadEraIndex,
  loadEraDetail,
  mergeEraDetail,
} from "@/data/eras";
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
const EMPTY_ERAS: Era[] = [];
const EMPTY_NODES: HistoryNode[] = [];
const PAGE_SIZE = 12;
/** Builds the shareable address for a view: /?era=tang&node=tang-li-bai */
function viewHref(view: ViewState): string {
  const params = new URLSearchParams();
  if (view.eraId) params.set("era", view.eraId);
  if (view.nodeId) params.set("node", view.nodeId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
/** Reads a view back out of the current address. */
function readView(): ViewState {
  if (typeof window === "undefined") return ROOT;
  const params = new URLSearchParams(window.location.search);
  return {
    eraId: params.get("era") || null,
    nodeId: params.get("node") || null,
  };
}
const STORAGE_KEY = "huaxia-exploration-v2";
const SORT_MODES: SortMode[] = ["chronological", "reverse", "relevance"];
type SavedPreferences = { theme: ThemeMode; tags: string[]; sort: SortMode };
/** Reads saved preferences during the first render; never throws. */
function readPreferences(): SavedPreferences {
  const fallback: SavedPreferences = {
    theme: "night",
    tags: [],
    sort: "chronological",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return fallback;
    return {
      theme: saved.theme === "day" ? "day" : "night",
      tags: Array.isArray(saved.tags)
        ? [
            ...new Set<string>(
              saved.tags.filter(
                (t: unknown) => typeof t === "string" && t in TAG_LABELS,
              ),
            ),
          ]
        : [],
      sort: SORT_MODES.includes(saved.sort) ? saved.sort : "chronological",
    };
  } catch {
    // Storage may be unavailable in private browsing.
    return fallback;
  }
}
export default function Explorer() {
  const [eras, setEras] = useState<Era[] | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [libraryRetry, setLibraryRetry] = useState(0);
  const [pageChoice, setPageChoice] = useState({ key: "", page: 0 });
  const [historyDepth, setHistoryDepth] = useState(0);
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
  const pose = useRef<CameraPose | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const indexEras = eras ?? EMPTY_ERAS;
  const allNodes = useMemo(
    () =>
      new Map<string, { node: HistoryNode; era: Era }>(
        indexEras.flatMap((e) =>
          e.nodes.map((n) => [n.id, { node: n, era: e }] as const),
        ),
      ),
    [indexEras],
  );
  const allRelations = useMemo(
    () => indexEras.flatMap((e) => e.relations),
    [indexEras],
  );
  const era = indexEras.find((e) => e.id === view.eraId);
  const node = view.nodeId ? allNodes.get(view.nodeId)?.node : undefined;
  const totalNodes = allNodes.size;
  const eraCount = indexEras.length || ERA_COUNT;
  const is3D = theme === "night" && webgl === true && !flat;
  const motionStopped = paused || reduced;
  const matchingIds = useMemo(
    () =>
      tags.length
        ? indexEras.flatMap((e) =>
            e.nodes.filter((n) => matchesInterest(n, tags)).map((n) => n.id),
          )
        : null,
    [indexEras, tags],
  );
  const filteredEras = useMemo(
    () => sortedEras(indexEras, tags, sort),
    [indexEras, tags, sort],
  );
  const filteredNodes = useMemo(
    () => (era ? sortedNodes(era.nodes, tags, sort) : EMPTY_NODES),
    [era, tags, sort],
  );
  const pageKey = `${view.eraId}:${tags.join(",")}:${sort}`;
  const pageCount = Math.max(1, Math.ceil(filteredNodes.length / PAGE_SIZE));
  const selectedPage = node
    ? Math.floor(filteredNodes.findIndex((n) => n.id === node.id) / PAGE_SIZE)
    : -1;
  const graphPage = Math.min(
    pageCount - 1,
    pageChoice.key === pageKey ? pageChoice.page : Math.max(0, selectedPage),
  );
  const pageNodes = useMemo(() => {
    if (!era) return [];
    const slice = filteredNodes.slice(
      graphPage * PAGE_SIZE,
      (graphPage + 1) * PAGE_SIZE,
    );
    if (node && !slice.some((n) => n.id === node.id)) slice.push(node);
    return slice;
  }, [era, filteredNodes, graphPage, node]);
  // Relations whose other end sits on a different page cannot be drawn. Count
  // them so the pager can say so instead of silently losing the connections.
  const hiddenRelations = useMemo(() => {
    if (!era) return 0;
    const shown = new Set(pageNodes.map((n) => n.id));
    return era.relations.filter(
      (r) =>
        (shown.has(r.source) || shown.has(r.target)) &&
        !(shown.has(r.source) && shown.has(r.target)),
    ).length;
  }, [era, pageNodes]);
  const sceneEras = useMemo(
    () =>
      era
        ? indexEras.map((e) =>
            e.id === era.id ? { ...e, nodes: pageNodes } : e,
          )
        : indexEras,
    [indexEras, era, pageNodes],
  );
  useEffect(() => {
    const controller = new AbortController();
    loadEraIndex(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setEras(value);
        setLibraryStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLibraryStatus("error");
      });
    return () => controller.abort();
  }, [libraryRetry]);
  // Article bodies, evidence and reign records for the open topic only.
  useEffect(() => {
    if (!view.eraId || !eras) return;
    const target = eras.find((e) => e.id === view.eraId);
    if (!target || target.summary !== undefined) return;
    let active = true;
    loadEraDetail(view.eraId)
      .then((detail) => {
        if (!active) return;
        setEras(
          (current) =>
            current?.map((e) =>
              e.id === detail.id && e.summary === undefined
                ? mergeEraDetail(e, detail)
                : e,
            ) ?? current,
        );
      })
      .catch(() => {
        /* The index already carries titles, dates and summaries to read. */
      });
    return () => {
      active = false;
    };
  }, [view.eraId, eras]);
  // This component is server rendered, so stored preferences cannot seed the
  // initial state without a hydration mismatch. They are applied once after
  // mount instead, and `preferencesLoaded` gates the controls until then.
  useEffect(() => {
    const saved = readPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved.theme);
    setTags(saved.tags);
    setSort(saved.sort);
    setPreferencesLoaded(true);
  }, []);
  // Adopts the address the reader arrived on, then follows the browser's back
  // and forward buttons. The same handler covers a shared link and a reload.
  useEffect(() => {
    const opened = readView();
    if (opened.eraId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(opened);
      setPanelOpen(true);
      setReset((n) => n + 1);
    }
    const step = window.history.state?.huaxiaStep;
    const depth = Number.isInteger(step) && step > 0 ? step : 0;
    window.history.replaceState(
      { ...window.history.state, huaxiaStep: depth },
      "",
    );
    setHistoryDepth(depth);
    const onPop = () => {
      const next = readView();
      const state = window.history.state;
      setView(next);
      setPanelOpen(!!next.eraId);
      setPageChoice({ key: "", page: 0 });
      setRestore(state?.huaxiaPose ?? null);
      setHistoryDepth(
        Number.isInteger(state?.huaxiaStep) ? state.huaxiaStep : 0,
      );
      setReset((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "night");
    if (preferencesLoaded) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
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
    // Probing the browser for WebGL 2 is exactly the kind of external lookup an
    // effect is for; it runs once and decides between the 3D and 2D views.
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // Every move is a real history entry, so a topic or an article can be linked,
  // reloaded and reached with the browser's own back and forward buttons. The
  // camera pose rides along in history.state to restore the view on the way back.
  const navigate = useCallback(
    (next: ViewState) => {
      if (next.eraId === view.eraId && next.nodeId === view.nodeId) {
        setPanelOpen(!!next.eraId);
        return;
      }
      const depth = (window.history.state?.huaxiaStep ?? 0) + 1;
      window.history.replaceState(
        {
          ...window.history.state,
          huaxiaPose: pose.current
            ? {
                position: [...pose.current.position],
                target: [...pose.current.target],
              }
            : null,
        },
        "",
      );
      window.history.pushState(
        { huaxiaStep: depth, huaxiaPose: null },
        "",
        viewHref(next),
      );
      setHistoryDepth(depth);
      setRestore(null);
      setView(next);
      setPanelOpen(!!next.eraId);
      setReset((n) => n + 1);
      setIndexOpen(false);
    },
    [view],
  );
  const goEra = useCallback(
    (id: string) => navigate({ eraId: id, nodeId: null }),
    [navigate],
  );
  const goNode = useCallback(
    (id: string) => {
      const entry = allNodes.get(id);
      if (entry) {
        // Let the page follow the selection rather than keeping a stale choice.
        setPageChoice({ key: "", page: 0 });
        navigate({ eraId: entry.era.id, nodeId: id });
      } else if (indexEras.some((e) => e.id === id)) goEra(id);
    },
    [allNodes, indexEras, navigate, goEra],
  );
  // Defers to the browser so the in-page button and the browser button do the
  // same thing; popstate below applies the resulting view.
  const goBack = useCallback(() => {
    if (historyDepth > 0) window.history.back();
  }, [historyDepth]);
  const goGlobal = useCallback(() => {
    if (view.eraId) navigate(ROOT);
    else {
      setRestore(null);
      setReset((n) => n + 1);
    }
  }, [view.eraId, navigate]);
  // Paging only changes which nodes the graph draws. The open archive stays
  // open, and this is not a navigation step, so it never enters the back stack.
  const changeGraphPage = useCallback(
    (page: number) => setPageChoice({ key: pageKey, page }),
    [pageKey],
  );
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
  const selectedIndex = era ? indexEras.indexOf(era) : -1;
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
            <a href="/learn" className="learning-nav-link">
              系统学习
            </a>
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
            <div
              className="academy-status"
              role={libraryStatus === "error" ? "alert" : "status"}
            >
              {libraryStatus === "loading"
                ? "正在载入历史目录…"
                : "历史目录未能载入，请检查网络后重试。"}
              {libraryStatus === "error" && (
                <button onClick={() => setLibraryRetry((n) => n + 1)}>
                  重新载入
                </button>
              )}
            </div>
          )}
          {theme === "day" ? (
            <DayGallery
              eras={indexEras}
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
                        <b>{eraCount}</b>历史专题
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
                  {String(era ? selectedIndex + 1 : eraCount).padStart(2, "0")}
                  <i>/ {eraCount}</i>
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
                  <button
                    aria-label="上一组节点"
                    disabled={graphPage === 0}
                    onClick={() => changeGraphPage(graphPage - 1)}
                  >
                    上一组
                  </button>
                  <span>
                    第 {graphPage + 1} / {pageCount} 组 · 共{" "}
                    {filteredNodes.length} 个节点
                  </span>
                  <button
                    aria-label="下一组节点"
                    disabled={graphPage === pageCount - 1}
                    onClick={() => changeGraphPage(graphPage + 1)}
                  >
                    下一组
                  </button>
                  <button
                    onClick={() => {
                      if (node) goEra(era.id);
                      else setPanelOpen(true);
                    }}
                  >
                    完整名单
                  </button>
                  {hiddenRelations > 0 && (
                    <span className="graph-pagination-note">
                      另有 {hiddenRelations}{" "}
                      条关系连向其他组，可在档案中沿关系继续阅读
                    </span>
                  )}
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
            {/* Real links: each topic has an address, so they can be opened in
                a new tab, copied, and followed by a crawler. A plain click is
                handled in-page to keep the scene and camera alive. */}
            {indexEras.map((e, i) => (
              <a
                key={e.id}
                href={viewHref({ eraId: e.id, nodeId: null })}
                aria-label={`探索${e.title}`}
                aria-current={view.eraId === e.id ? "true" : undefined}
                style={{ "--era-color": eraColor(i) } as React.CSSProperties}
                className={`timeline-era ${view.eraId === e.id ? "selected" : ""} ${tags.length && !e.nodes.some((n) => matchesInterest(n, tags)) ? "unmatched" : ""}`}
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.button !== 0
                  )
                    return;
                  event.preventDefault();
                  goEra(e.id);
                }}
              >
                <span className="timeline-dot" />
                <span className="era-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{e.shortTitle}</strong>
              </a>
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
          canBack={historyDepth > 0}
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
          eras={indexEras}
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
                      "--era-color": eraColor(indexEras.indexOf(e)),
                    } as React.CSSProperties
                  }
                  aria-current={view.eraId === e.id ? "true" : undefined}
                >
                  <span>
                    {String(indexEras.indexOf(e) + 1).padStart(2, "0")}
                  </span>
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
              : `中国历史全景，${eraCount}个历史专题`}
        </span>
      </main>
    </TooltipProvider>
  );
}
