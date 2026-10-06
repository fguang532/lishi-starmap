"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Crown,
  Feather,
  Swords,
  Sun,
  Moon,
  Search,
  ExternalLink,
  RotateCcw,
  Clock3,
  GitBranch,
  ChevronRight,
} from "lucide-react";
import type {
  ArchiveIndex,
  ArchiveRecord,
  LibraryCatalog,
  LibraryKind,
  Polity,
  Reign,
} from "@/data/library-types";
import type { Source } from "@/data/types";

type Selection = {
  kind: LibraryKind;
  era: string;
  polity: string;
  id: string;
  reign: string;
  q: string;
  sort: string;
};
const initial: Selection = {
  kind: "rulers",
  era: "",
  polity: "",
  id: "",
  reign: "",
  q: "",
  sort: "chronological",
};
const kinds = [
  {
    id: "rulers" as const,
    title: "君主世系",
    description: "按政权读继承与兴替",
    Icon: Crown,
  },
  {
    id: "battles" as const,
    title: "战役档案",
    description: "从起因读到结果",
    Icon: Swords,
  },
  {
    id: "poets" as const,
    title: "诗人与作品",
    description: "把作品放回时代",
    Icon: Feather,
  },
];
function readSelection(): Selection {
  const p = new URLSearchParams(window.location.search);
  const kind = p.get("kind");
  return {
    kind: kind === "battles" || kind === "poets" ? kind : "rulers",
    era: p.get("era") || "",
    polity: p.get("polity") || "",
    id: p.get("id") || "",
    reign: p.get("reign") || "",
    q: p.get("q") || "",
    sort: p.get("sort") === "reverse" ? "reverse" : "chronological",
  };
}
function Sources({ sources }: { sources: Source[] }) {
  return (
    <ol className="study-sources">
      {sources.map((s, i) => (
        <li key={s.url + i}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <a href={s.url} target="_blank" rel="noreferrer">
            <strong>{s.title}</strong>
            <small>{s.institution}</small>
            <ExternalLink size={14} />
          </a>
        </li>
      ))}
    </ol>
  );
}
function ReignCard({
  reign,
  current,
  onSelect,
}: {
  reign: Reign;
  current?: boolean;
  onSelect: (r: Reign) => void;
}) {
  return (
    <button
      className={`reign-card ${current ? "current" : ""}`}
      aria-current={current ? "true" : undefined}
      onClick={() => onSelect(reign)}
    >
      <span>{reign.succession}</span>
      <strong>{reign.title}</strong>
      {reign.rulerName && !reign.title.includes(reign.rulerName) && (
        <small>{reign.rulerName}</small>
      )}
      <small>{reign.dateLabel}</small>
    </button>
  );
}

export default function LearningLibrary() {
  const [selection, setSelection] = useState<Selection>(initial);
  const [ready, setReady] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [theme, setTheme] = useState<"day" | "night">("night");
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [recordError, setRecordError] = useState(false);
  const [retry, setRetry] = useState(0);
  const focusNext = useRef<"archive" | "dynasty" | null>(null);
  useEffect(() => {
    setSelection(readSelection());
    const savedStep = window.history.state?.huaxiaStudyStep;
    const initialStep =
      Number.isInteger(savedStep) && savedStep >= 0 ? savedStep : 0;
    window.history.replaceState(
      { ...window.history.state, huaxiaStudyStep: initialStep },
      "",
    );
    setCanGoBack(initialStep > 0);
    try {
      const saved = JSON.parse(
        localStorage.getItem("huaxia-exploration-v2") || "{}",
      );
      if (saved.theme === "day") setTheme("day");
    } catch {}
    setReady(true);
    const back = () => {
      setSelection(readSelection());
      setCanGoBack((window.history.state?.huaxiaStudyStep || 0) > 0);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "night");
    try {
      const saved = JSON.parse(
        localStorage.getItem("huaxia-exploration-v2") || "{}",
      );
      localStorage.setItem(
        "huaxia-exploration-v2",
        JSON.stringify({ ...saved, theme }),
      );
    } catch {}
  }, [theme, ready]);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(false);
    fetch("/library/catalog.json", {
      signal: controller.signal,
      cache: "no-cache",
    })
      .then((r) => {
        if (!r.ok) throw new Error("catalog");
        return r.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value as LibraryCatalog);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError")
          setCatalogError(true);
      });
    return () => controller.abort();
  }, [retry]);
  const indexes = useMemo(
    () => new Map(catalog?.records.map((r) => [r.id, r]) || []),
    [catalog],
  );
  const selected = indexes.get(selection.id);
  const polity = catalog?.polities.find((p) => p.id === selection.polity);
  const selectedFile = selected?.file;
  useEffect(() => {
    if (!selectedFile) {
      setRecord(null);
      return;
    }
    const controller = new AbortController();
    setRecordError(false);
    fetch(selectedFile, { signal: controller.signal, cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("archive");
        return r.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) setRecord(value as ArchiveRecord);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError")
          setRecordError(true);
      });
    return () => controller.abort();
  }, [selectedFile, retry]);
  const navigate = (patch: Partial<Selection>, replace = false) => {
    if (patch.id && patch.id !== selection.id)
      focusNext.current =
        patch.q === "" && patch.polity ? "dynasty" : "archive";
    const next = { ...selection, ...patch };
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v && !(k === "sort" && v === "chronological")) p.set(k, v);
    });
    const step =
      (window.history.state?.huaxiaStudyStep || 0) + (replace ? 0 : 1);
    window.history[replace ? "replaceState" : "pushState"](
      { ...window.history.state, huaxiaStudyStep: step },
      "",
      `/learn?${p}`,
    );
    setCanGoBack(step > 0);
    setSelection(next);
  };
  const chooseRecord = (r: ArchiveIndex, reign?: Reign) =>
    navigate({
      kind: r.kind,
      id: r.id,
      reign: reign?.id || "",
      polity: reign
        ? selection.polity
        : r.polityIds.includes(selection.polity)
          ? selection.polity
          : r.polityIds[0] || "",
    });
  const choosePolity = (p: Polity) => {
    const entries = [...p.reigns, ...(p.regencies || [])];
    const first =
      entries.find(
        (term) =>
          !selection.era ||
          indexes.get(term.rulerId)?.eraIds.includes(selection.era),
      ) || entries[0];
    navigate({
      polity: p.id,
      id: first?.rulerId || "",
      reign: first?.id || "",
      q: "",
    });
  };
  const chooseReign = (r: Reign) => {
    const target = catalog?.polities.find((p) =>
      [...p.reigns, ...(p.regencies || [])].some((term) => term.id === r.id),
    );
    if (target)
      navigate({
        kind: "rulers",
        polity: target.id,
        id: r.rulerId,
        reign: r.id,
        q: "",
        era: indexes.get(r.rulerId)?.eraIds.includes(selection.era)
          ? selection.era
          : "",
      });
  };
  const visiblePolities =
    catalog?.polities
      .filter(
        (p) =>
          (!selection.era || p.eraIds.includes(selection.era)) &&
          (!selection.q || `${p.title} ${p.scopeNote}`.includes(selection.q)),
      )
      .sort(
        (a, b) =>
          (selection.sort === "reverse" ? -1 : 1) * (a.sortYear - b.sortYear),
      ) || [];
  const visibleRecords =
    catalog?.records
      .filter(
        (r) =>
          r.kind === selection.kind &&
          (!selection.era || r.eraIds.includes(selection.era)) &&
          (!selection.polity || r.polityIds.includes(selection.polity)) &&
          (!selection.q ||
            `${r.name} ${r.title} ${r.aliases.join(" ")} ${r.summary} ${r.searchText || ""}`.includes(
              selection.q,
            )),
      )
      .sort(
        (a, b) =>
          (selection.sort === "reverse" ? -1 : 1) * (a.sortYear - b.sortYear),
      ) || [];
  const allReigns = useMemo(
    () =>
      catalog?.polities.flatMap((p) =>
        [...p.reigns, ...(p.regencies || [])].map((r) => ({ ...r, polity: p })),
      ) || [],
    [catalog],
  );
  const reign =
    allReigns.find(
      (r) => r.id === selection.reign && r.rulerId === selection.id,
    ) ||
    allReigns.find(
      (r) => r.rulerId === selection.id && r.polity.id === selection.polity,
    );
  const personReigns = allReigns.filter((r) => r.rulerId === selection.id);
  const previous = allReigns.filter((r) =>
    reign?.predecessorIds.includes(r.id),
  );
  const following = allReigns.filter(
    (r) => reign && r.predecessorIds.includes(reign.id),
  );
  const full = record?.id === selection.id ? record : null;
  useEffect(() => {
    if (!full || !focusNext.current) return;
    const target =
      focusNext.current === "dynasty" ? ".study-reading" : ".archive-heading";
    focusNext.current = null;
    const frame = requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(target);
      element?.scrollIntoView({ block: "start", behavior: "instant" });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [full]);
  useEffect(() => {
    document
      .querySelector(".succession-scroll .reign-card.current")
      ?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "instant",
      });
  }, [selection.reign, selection.id]);
  const browsingPolities =
    selection.kind === "rulers" && !selection.polity && !selection.q;
  const counts = (kind: LibraryKind) =>
    catalog?.records.filter((r) => r.kind === kind).length || 0;
  return (
    <main
      className={`learning-app study-${theme}`}
      data-library-ready={ready && !!catalog}
    >
      <header className="study-topbar">
        <a className="study-brand" href="/">
          <span>华夏</span>
          <strong>
            历史学堂<small>人物有生平 · 事件有脉络 · 作品有时代</small>
          </strong>
        </a>
        <div>
          {canGoBack && (
            <button
              className="study-back study-history-back"
              onClick={() => window.history.back()}
              aria-label="返回上一页档案"
            >
              <RotateCcw size={16} />
              <span>返回上一页</span>
            </button>
          )}
          <a href="/" className="study-back" aria-label="返回星图">
            <ArrowLeft size={16} />
            <span>返回星图</span>
          </a>
          <button
            className="study-theme"
            disabled={!ready}
            aria-label={
              theme === "night" ? "切换白天古风模式" : "切换夜间星图模式"
            }
            onClick={() => setTheme(theme === "night" ? "day" : "night")}
          >
            {theme === "night" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <div className="study-intro">
        <div>
          <span className="study-kicker">CHRONICLES · 历史文化档案</span>
          <h1>沿着脉络，读懂历史</h1>
          <p>选择一个政权、一场战役或一位诗人，从有出处的记录开始。</p>
        </div>
        {catalog && (
          <div className="study-totals">
            <strong>
              {catalog.polities.length}
              <small>政权分支</small>
            </strong>
            <strong>
              {counts("rulers")}
              <small>君主与执政者</small>
            </strong>
            <strong>
              {counts("battles") + counts("poets")}
              <small>战役与诗人</small>
            </strong>
          </div>
        )}
      </div>
      <nav className="study-kinds" aria-label="学习类别">
        {kinds.map((k) => (
          <button
            key={k.id}
            aria-pressed={selection.kind === k.id}
            onClick={() =>
              navigate({ ...initial, kind: k.id, era: selection.era })
            }
          >
            <k.Icon size={23} />
            <span>
              <strong>{k.title}</strong>
              <small>{k.description}</small>
            </span>
            <b>{counts(k.id)}</b>
          </button>
        ))}
      </nav>
      {catalogError ? (
        <div className="study-empty" role="alert">
          <h2>档案目录暂时未能加载</h2>
          <p>请检查网络后重试。</p>
          <button onClick={() => setRetry((v) => v + 1)}>
            <RotateCcw size={15} />
            重新加载
          </button>
        </div>
      ) : !catalog ? (
        <div className="study-loading" role="status">
          正在展开历史目录…
        </div>
      ) : (
        <>
          <div className="study-filters">
            <label className="study-search">
              <Search size={17} />
              <input
                aria-label="搜索历史档案"
                placeholder={
                  selection.kind === "rulers"
                    ? "搜索姓名、帝号或事迹"
                    : selection.kind === "poets"
                      ? "搜索诗人、字号或作品线索"
                      : "搜索战役、人物或地点"
                }
                value={selection.q}
                onChange={(e) =>
                  navigate(
                    {
                      q: e.target.value,
                      id: "",
                      reign: "",
                      ...(selection.kind === "rulers" ? { polity: "" } : {}),
                    },
                    true,
                  )
                }
              />
            </label>
            <label>
              <span>历史时期</span>
              <select
                aria-label="学习档案历史时期"
                value={selection.era}
                onChange={(e) =>
                  navigate({
                    era: e.target.value,
                    polity: "",
                    id: "",
                    reign: "",
                  })
                }
              >
                <option value="">全部时期</option>
                {catalog.eras.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>排列顺序</span>
              <select
                aria-label="学习档案排序"
                value={selection.sort}
                onChange={(e) => navigate({ sort: e.target.value })}
              >
                <option value="chronological">年代从早到晚</option>
                <option value="reverse">年代从晚到早</option>
              </select>
            </label>
          </div>
          <div className="study-layout">
            <aside className="study-catalog">
              <div className="study-catalog-heading">
                <h2>
                  {browsingPolities
                    ? "选择政权"
                    : polity?.title ||
                      kinds.find((k) => k.id === selection.kind)?.title}
                </h2>
                <span>
                  {browsingPolities
                    ? visiblePolities.length
                    : visibleRecords.length}{" "}
                  项
                </span>
              </div>
              {selection.polity && (
                <button
                  className="study-all-polities"
                  onClick={() => navigate({ polity: "", id: "", reign: "" })}
                >
                  <ArrowLeft size={14} />
                  返回政权目录
                </button>
              )}
              <div className="study-catalog-scroll">
                {browsingPolities
                  ? visiblePolities.map((p) => (
                      <button
                        className="study-polity"
                        key={p.id}
                        onClick={() => choosePolity(p)}
                      >
                        <strong>{p.title}</strong>
                        <small>
                          {p.reigns.length
                            ? `${new Set(p.reigns.map((r) => r.rulerId)).size} 位君主 · ${p.reigns.length} 段在位经历`
                            : "监国支系"}
                          {p.regencies?.length
                            ? ` · ${p.regencies.length} 段称制 / 摄政`
                            : ""}
                        </small>
                        <ChevronRight size={15} />
                      </button>
                    ))
                  : visibleRecords.map((r) => (
                      <button
                        key={r.id}
                        className={`study-record ${r.id === selection.id ? "selected" : ""}`}
                        aria-current={
                          r.id === selection.id ? "true" : undefined
                        }
                        onClick={() => chooseRecord(r)}
                      >
                        <strong>
                          {r.title}
                          <span>{r.name !== r.title ? r.name : ""}</span>
                        </strong>
                        <small>{r.lifeLabel}</small>
                        <p>{r.summary}</p>
                      </button>
                    ))}
                {!(browsingPolities
                  ? visiblePolities.length
                  : visibleRecords.length) && (
                  <div className="study-empty small">
                    <p>当前条件下没有匹配档案。</p>
                    <button
                      onClick={() =>
                        navigate({
                          era: "",
                          q: "",
                          polity: "",
                          id: "",
                          reign: "",
                        })
                      }
                    >
                      查看全部档案
                    </button>
                  </div>
                )}
              </div>
            </aside>
            <section className="study-reading" aria-live="polite" tabIndex={-1}>
              {polity && (
                <section className="study-dynasty">
                  <div>
                    <span className="study-kicker">SUCCESSION · 政治继承</span>
                    <h2>
                      {polity.title}
                      {polity.reigns.length ? "君主世系" : "监国记录"}
                    </h2>
                  </div>
                  <p>{polity.scopeNote}</p>
                  <div
                    className="succession-scroll"
                    aria-label={`${polity.title}完整在位序列`}
                  >
                    {polity.reigns.map((r, i) => (
                      <div className="succession-stop" key={r.id}>
                        <span className="succession-order">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <ReignCard
                          reign={r}
                          current={reign?.id === r.id}
                          onSelect={chooseReign}
                        />
                        <span className="succession-method">
                          {r.predecessorIds.length ? r.succession : "支系起点"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!!polity.regencies?.length && (
                    <div className="study-regencies">
                      <h3>称制、监国与摄政记录</h3>
                      <div className="person-reigns">
                        {polity.regencies.map((r) => (
                          <button key={r.id} onClick={() => chooseReign(r)}>
                            <span>{r.role}</span>
                            <strong>{r.title}</strong>
                            <small>{r.dateLabel}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="study-note">
                    按在位经历排列；序列中的相邻位置不代表血缘或直接继承，具体关系见下方有据连线。
                  </p>
                </section>
              )}
              {!selection.id ? (
                <div className="study-welcome">
                  <div className="study-welcome-mark">
                    {selection.kind === "rulers" ? (
                      <GitBranch size={42} />
                    ) : selection.kind === "battles" ? (
                      <Swords size={42} />
                    ) : (
                      <Feather size={42} />
                    )}
                  </div>
                  <h2>
                    {selection.kind === "rulers"
                      ? "从政权的完整世系开始"
                      : selection.kind === "battles"
                        ? "一场战役，放回完整的历史过程"
                        : "读诗，也读写诗的人"}
                  </h2>
                  <p>
                    {selection.kind === "rulers"
                      ? "点击左侧政权，查看历任君主及其在位经历，再进入逐人档案。并立政权各有支系，复位归入同一人物。"
                      : selection.kind === "battles"
                        ? "选择一场战役，了解交战方、地点、战前局势、作战经过与长期影响。战争、起义和单场战役会明确区分。"
                        : "选择一位诗人，沿个人年表理解他的经历，再读作品原文、写作背景和赏析。"}
                  </p>
                  <div className="study-scope">
                    <h3>收录与证据</h3>
                    <p>{catalog.scopeNote}</p>
                  </div>
                </div>
              ) : !selected ? (
                <div className="study-empty">
                  <h2>没有找到这个档案</h2>
                  <button
                    onClick={() => navigate({ id: "", reign: "", polity: "" })}
                  >
                    返回目录
                  </button>
                </div>
              ) : recordError ? (
                <div className="study-empty" role="alert">
                  <h2>档案暂时未能加载</h2>
                  <button onClick={() => setRetry((v) => v + 1)}>重试</button>
                </div>
              ) : !full ? (
                <div className="study-loading" role="status">
                  正在打开{selected.title}的档案…
                </div>
              ) : (
                <article className="study-article" key={full.id}>
                  <header className="archive-heading" tabIndex={-1}>
                    <span className="study-kicker">
                      {full.kind === "rulers"
                        ? "君主档案"
                        : full.kind === "battles"
                          ? "战役档案"
                          : "诗人档案"}{" "}
                      · {full.certainty}
                    </span>
                    <h2>{full.title}</h2>
                    <div className="archive-meta">
                      <span>{full.name !== full.title ? full.name : ""}</span>
                      <span>
                        <Clock3 size={14} />
                        {full.lifeLabel}
                      </span>
                    </div>
                    {full.aliases.length > 0 && (
                      <p className="archive-aliases">
                        名号与别称：{full.aliases.join("、")}
                      </p>
                    )}
                    <p className="archive-lead">{full.summary}</p>
                  </header>
                  {full.facts?.length ? (
                    <dl className="archive-facts">
                      {full.facts.map((f) => (
                        <div key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <nav className="archive-toc" aria-label="档案目录">
                    <a href="#archive-story">
                      {full.kind === "battles" ? "战役详解" : "人物详传"}
                    </a>
                    <a href="#archive-timeline">
                      {full.kind === "battles" ? "战事进程" : "生平年表"}
                    </a>
                    {personReigns.length > 0 && (
                      <a href="#archive-succession">在位与继承</a>
                    )}
                    {!!full.works?.length && (
                      <a href="#archive-works">作品与赏析</a>
                    )}
                    <a href="#archive-sources">资料来源</a>
                  </nav>
                  <div id="archive-story" className="archive-sections">
                    {full.sections.map((s, i) => (
                      <section key={s.title}>
                        <span className="archive-section-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h3>{s.title}</h3>
                          {s.text
                            .split(/\n+/)
                            .filter(Boolean)
                            .map((p, j) => (
                              <p key={j}>{p}</p>
                            ))}
                        </div>
                      </section>
                    ))}
                  </div>
                  <section id="archive-timeline" className="archive-section">
                    <h3>
                      <Clock3 size={19} />
                      {full.kind === "battles" ? "战事进程" : "生平年表"}
                    </h3>
                    <ol className="archive-timeline">
                      {full.timeline.map((e, i) => (
                        <li key={i}>
                          <span>{e.dateLabel}</span>
                          <div>
                            <h4>{e.title}</h4>
                            <p>{e.text}</p>
                            <a
                              href={e.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              本条依据
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                  {personReigns.length > 0 && (
                    <section
                      id="archive-succession"
                      className="archive-section"
                    >
                      <h3>
                        <Crown size={19} />
                        在位经历与继承关系
                      </h3>
                      <div className="person-reigns">
                        {personReigns.map((r) => (
                          <button
                            key={r.id}
                            aria-pressed={reign?.id === r.id}
                            onClick={() => chooseReign(r)}
                          >
                            <span>{r.polity.title}</span>
                            <strong>{r.title}</strong>
                            <small>{r.dateLabel}</small>
                          </button>
                        ))}
                      </div>
                      {reign && (
                        <>
                          <div className="succession-neighbors">
                            <div>
                              <h4>有据前任</h4>
                              {previous.length ? (
                                previous.map((r) => (
                                  <ReignCard
                                    key={r.id}
                                    reign={r}
                                    onSelect={chooseReign}
                                  />
                                ))
                              ) : (
                                <p>此支系的起点，或未设确定前任。</p>
                              )}
                            </div>
                            <div className="succession-current">
                              <h4>{reign.succession}</h4>
                              <ReignCard
                                reign={reign}
                                current
                                onSelect={chooseReign}
                              />
                            </div>
                            <div>
                              <h4>有据后继</h4>
                              {following.length ? (
                                following.map((r) => (
                                  <ReignCard
                                    key={r.id}
                                    reign={r}
                                    onSelect={chooseReign}
                                  />
                                ))
                              ) : (
                                <p>本支系止于此，或暂无确定后继。</p>
                              )}
                            </div>
                          </div>
                          <p className="succession-explanation">{reign.note}</p>
                          <a
                            className="study-source-inline"
                            href={reign.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            继承记录依据
                            <ExternalLink size={13} />
                          </a>
                        </>
                      )}
                    </section>
                  )}
                  {!!full.works?.length && (
                    <section id="archive-works" className="archive-section">
                      <h3>
                        <Feather size={19} />
                        作品与赏析
                      </h3>
                      {full.works.map((w) => (
                        <article className="archive-work" key={w.title}>
                          <span>
                            {w.genre} · {w.dateLabel}
                          </span>
                          <h4>{w.title}</h4>
                          <blockquote>{w.text}</blockquote>
                          <h5>写作背景</h5>
                          <p>{w.context}</p>
                          <h5>如何读这首作品</h5>
                          <p>{w.analysis}</p>
                          <a
                            className="study-source-inline"
                            href={w.source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {w.source.title}
                            <ExternalLink size={13} />
                          </a>
                        </article>
                      ))}
                    </section>
                  )}
                  {!!full.relatedIds?.length && (
                    <section className="archive-section">
                      <h3>
                        <GitBranch size={19} />
                        关联档案
                      </h3>
                      <div className="archive-related">
                        {full.relatedIds
                          .map((id) => indexes.get(id))
                          .filter((r): r is ArchiveIndex => !!r)
                          .map((r) => (
                            <button
                              key={r.id}
                              onClick={() =>
                                navigate({
                                  ...initial,
                                  kind: r.kind,
                                  id: r.id,
                                  polity: r.polityIds[0] || "",
                                })
                              }
                            >
                              <strong>{r.title}</strong>
                              <small>{r.lifeLabel}</small>
                            </button>
                          ))}
                      </div>
                    </section>
                  )}
                  <section id="archive-sources" className="archive-section">
                    <h3>
                      <BookOpen size={19} />
                      资料来源
                    </h3>
                    <Sources sources={full.sources} />
                    <p className="study-note">
                      传记为依据资料整理的学习读本。存疑生卒、争立与文献传说按条目标注；不把后世称号当作当时在位事实。
                    </p>
                  </section>
                </article>
              )}
            </section>
          </div>
        </>
      )}
      <footer className="study-footer">
        <span>华夏星图 · 历史文化学习</span>
        <a href="/">回到文明全景</a>
        <span>史实与证据的边界，同样是历史的一部分。</span>
      </footer>
    </main>
  );
}
