"use client";
import { useRef, useEffect } from "react";
import { X, BookOpen, Link2, ExternalLink, ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Era, HistoryNode, Relation } from "@/data/types";
import { TYPE_COLORS } from "@/data/types";
type Props = {
  era: Era | undefined;
  node: HistoryNode | undefined;
  open: boolean;
  mobile: boolean;
  relations: Relation[];
  allNodes: Map<string, { node: HistoryNode; era: Era }>;
  onClose: () => void;
  onNode: (id: string) => void;
  onBack: () => void;
  canBack: boolean;
};
export default function DetailPanel({
  era,
  node,
  open,
  mobile,
  relations,
  allNodes,
  onClose,
  onNode,
  onBack,
  canBack,
}: Props) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    if (open && node) body.current?.focus({ preventScroll: true });
  }, [era?.id, node?.id, open]);
  if (!era) return null;
  const item = node ?? era;
  const links = node
    ? relations.filter((r) => r.source === node.id || r.target === node.id)
    : [];
  return (
    <Sheet
      open={open}
      modal={mobile}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side={mobile ? "bottom" : "right"}
        showCloseButton={false}
        className={`history-panel ${mobile ? "history-panel-mobile" : ""}`}
        onInteractOutside={(e) => {
          if (!mobile) e.preventDefault();
        }}
        onOpenAutoFocus={(e) => {
          if (!mobile) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="panel-topline">
          <span>
            <BookOpen size={14} />
            {node ? "历史档案" : "时期概览"}
          </span>
          <div>
            {canBack && (
              <button
                className="panel-icon"
                onClick={onBack}
                aria-label="返回上一节点"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <button
              className="panel-icon"
              onClick={onClose}
              aria-label="收起详情"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div
          className="panel-scroll"
          ref={body}
          tabIndex={0}
          aria-label="历史详情内容"
        >
          <div className="panel-heading">
            <span className="eyebrow">
              {node ? era.title : era.englishTitle}
            </span>
            <SheetTitle className="detail-title">{item.title}</SheetTitle>
            <SheetDescription className="detail-date">
              {item.dateLabel}
            </SheetDescription>
            {node && (
              <div className="node-badges">
                <span style={{ color: TYPE_COLORS[node.type] }}>
                  {node.type}
                </span>
                {node.certainty !== "史实" && (
                  <span className="certainty-badge">{node.certainty}</span>
                )}
              </div>
            )}
          </div>
          {node ? (
            <>
              <p className="detail-lead">{node.summary}</p>
              <section className="prose-section">
                <h3>
                  <span>01</span>时代背景
                </h3>
                <p>{node.background}</p>
              </section>
              <section className="prose-section">
                <h3>
                  <span>02</span>历史脉络
                </h3>
                <p>{node.story}</p>
              </section>
              <section className="prose-section">
                <h3>
                  <span>03</span>影响与回响
                </h3>
                <p>{node.legacy}</p>
              </section>
            </>
          ) : (
            <>
              <div className="overview-copy">
                {era.summary
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
              <section className="era-node-list">
                <h3>
                  这一时期的历史节点 <small>{era.nodes.length}</small>
                </h3>
                {era.nodes.map((n) => (
                  <button key={n.id} onClick={() => onNode(n.id)}>
                    <span
                      className="node-type-dot"
                      style={{ background: TYPE_COLORS[n.type] }}
                    />
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {n.type} · {n.dateLabel}
                      </small>
                    </span>
                    <span className="open-node-mark">＋</span>
                  </button>
                ))}
              </section>
            </>
          )}
          {node && (
            <section className="related-section">
              <h3>
                <Link2 size={14} />
                沿着关系继续探索
              </h3>
              {links.length ? (
                links.map((r) => {
                  const other = allNodes.get(
                    r.source === node.id ? r.target : r.source,
                  );
                  if (!other) return null;
                  return (
                    <div className="related-item" key={r.id}>
                      <button onClick={() => onNode(other.node.id)}>
                        <span className="relation-name">{r.type}</span>
                        <strong>{other.node.title}</strong>
                        <span>＋</span>
                      </button>
                      <p>{r.explanation}</p>
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                        关系依据 <ExternalLink size={11} />
                      </a>
                    </div>
                  );
                })
              ) : (
                <p className="quiet-copy">
                  可从下方返回时期，继续探索其他节点。
                </p>
              )}
              <button
                className="back-era-button"
                onClick={() => onNode(era.id)}
              >
                查看{era.title}全部节点
              </button>
            </section>
          )}
          <section className="source-section">
            <h3>
              <BookOpen size={14} />
              资料来源
            </h3>
            <ol>
              {item.sources.map((s, i) => (
                <li key={s.url + i}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>{s.institution}</small>
                    </div>
                    <ExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ol>
            <p>精选资料经归纳撰写；有争议的年代与说法会在正文中标明。</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
