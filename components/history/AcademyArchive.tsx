"use client";
import { useEffect, useState } from "react";
import type { ArchiveRecord } from "@/data/library-types";
import type { HistoryNode } from "@/data/types";

const cache = new Map<string, ArchiveRecord>();
const kindLabels = { rulers: "君主档案与世系", battles: "战役详解", poets: "诗人与作品" };

export default function AcademyArchive({ node, eraId, onNode }: {
  node: HistoryNode; eraId: string; onNode: (id: string) => void;
}) {
  const archives = node.archives || [];
  const [selected, setSelected] = useState(archives[0]?.id || "");
  const [loaded, setLoaded] = useState<ArchiveRecord | null>(cache.get(selected) || null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const full = loaded?.id === selected ? loaded : null;
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    if (cache.has(selected)) { setLoaded(cache.get(selected)!); return; }
    fetch(`/library/archive/${encodeURIComponent(selected)}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("档案读取失败"); return r.json(); })
      .then(value => {
        const r = value as ArchiveRecord;
        if (r.id !== selected) throw new Error("档案不匹配");
        if (!controller.signal.aborted) { cache.set(selected, r); setLoaded(r); }
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [selected, retry]);
  return (
    <div className="academy-archive">
      <nav className="academy-tabs" aria-label="档案身份">
        {archives.map(a => <button key={a.id} aria-pressed={selected === a.id} onClick={() => setSelected(a.id)}>{kindLabels[a.kind]}</button>)}
      </nav>
      {full ? <>
        <p className="academy-certainty">{full.lifeLabel} · {full.certainty}</p>
        {full.facts?.length ? <dl className="academy-facts">{full.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl> : null}
        {full.sections.map((s, i) => <section className="prose-section" key={s.title}>
          <h3><span>{String(i + 1).padStart(2, "0")}</span>{s.title}</h3>
          <p>{s.text}</p>
        </section>)}
        <section className="prose-section academy-timeline">
          <h3>{full.kind === "battles" ? "战事进程" : "生平年表"}</h3>
          <ol>{full.timeline.map((event, i) => <li key={i}>
            <small>{event.dateLabel}</small><h4>{event.title}</h4><p>{event.text}</p>
            <a href={event.sourceUrl} target="_blank" rel="noreferrer">本条依据 ↗</a>
          </li>)}</ol>
        </section>
        {full.kind === "rulers" && !!node.terms?.length && <section className="prose-section academy-timeline">
          <h3>在位经历</h3><ol>{node.terms.map((term, i) => <li key={i}>
            <small>{term.polity} · {term.dateLabel}</small><h4>{term.title}</h4><p>{term.note}</p>
            <a href={term.sourceUrl} target="_blank" rel="noreferrer">史料依据 ↗</a>
          </li>)}</ol>
        </section>}
        {full.works?.map(work => <section key={work.title} className="prose-section academy-work">
          <h3>《{work.title}》</h3><small>{work.genre} · {work.dateLabel}</small>
          <blockquote>{work.text}</blockquote><h4>写作背景</h4><p>{work.context}</p>
          <h4>作品赏析</h4><p>{work.analysis}</p>
          <a href={work.source.url} target="_blank" rel="noreferrer">{work.source.title} ↗</a>
        </section>)}
        <section className="prose-section academy-sources"><h3>学堂档案来源</h3>
          {full.sources.map((s, i) => <a key={s.url + i} href={s.url} target="_blank" rel="noreferrer">{s.institution} · {s.title} ↗</a>)}
        </section>
      </> : <>
        <p role="status">{failed ? "完整档案暂未载入，下方为已保存的解读。" : "正在载入完整档案…"}
          {failed && <button onClick={() => setRetry(n => n + 1)}>重试</button>}</p>
        {[node.background, node.story, node.legacy].map((text, i) => <p className="detail-lead" key={i}>{text}</p>)}
      </>}
      {full && !node.id.startsWith("academy-") && <details className="academy-curated"><summary>原精选解读</summary>
        {[node.background, node.story, node.legacy].map((text, i) => <p key={i}>{text}</p>)}
      </details>}
      <nav className="panel-learning-links" aria-label="在历史学堂继续阅读">
        {archives.map(a => <a key={a.id} href={`/learn?kind=${a.kind}&era=${eraId}&id=${a.id}`}>打开{kindLabels[a.kind]} ↗</a>)}
      </nav>
      {!!node.relatedReading?.length && <section className="prose-section academy-reading"><h3>关联阅读</h3>
        {node.relatedReading.map(r => <button key={r.id} onClick={() => onNode(r.id)}>{r.title} →</button>)}
      </section>}
    </div>
  );
}
