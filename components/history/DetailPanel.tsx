"use client";
import { useRef, useEffect, useState } from "react";
import { X, BookOpen, Link2, ExternalLink, ChevronLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Era, HistoryNode, Relation } from "@/data/types";
import { TYPE_COLORS } from "@/data/types";
import { imagesFor, TAG_LABELS } from "@/data/exploration";
import HeritageImage from "./HeritageImage";
import StoryNotes from "./StoryNotes";
import AcademyArchive from "./AcademyArchive";
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
  filteredNodes: HistoryNode[];
  filterActive: boolean;
  onClearFilter: () => void;
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
  filteredNodes,
  filterActive,
  onClearFilter,
}: Props) {
  const body = useRef<HTMLDivElement>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    if (open && node) body.current?.focus({ preventScroll: true });
  }, [era?.id, node?.id, open]);
  if (!era) return null;
  const item = node ?? era;
  const images = imagesFor(era.id, node?.id);
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
          // Moving focus into or out of the image dialog should keep this archive open.
          if (
            !mobile ||
            e.detail.originalEvent.type === "focusin" ||
            document.querySelector(".art-lightbox[data-state=open]")
          )
            e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (expandedImage) {
            e.preventDefault();
            setExpandedImage(null);
          }
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
                {node.tags?.slice(0, 3).map((t) => (
                  <span key={t} className="interest-badge">
                    {TAG_LABELS[t]}
                  </span>
                ))}
              </div>
            )}
          </div>
          {node &&
            filterActive &&
            !filteredNodes.some((n) => n.id === node.id) && (
              <p className="filter-notice">
                正在阅读关联档案，此节点不在当前偏好内。
                <button onClick={onClearFilter}>显示全部节点</button>
              </p>
            )}
          {images.map((im) => (
            <HeritageImage
              key={im.id}
              image={im}
              open={expandedImage === im.id}
              onOpenChange={(value) => setExpandedImage(value ? im.id : null)}
              context={!!node && !im.nodeIds.includes(node.id)}
            />
          ))}
          {node ? (
            <>
              <p className="detail-lead">{node.summary}</p>
              {!!node.affiliations?.length && (
                <p className="academy-affiliation">
                  {node.affiliations.join(" · ")}
                </p>
              )}
              {node.archives?.length ? (
                <AcademyArchive
                  key={node.id}
                  node={node}
                  eraId={era.id}
                  onNode={onNode}
                />
              ) : node.background === undefined ? (
                <p className="panel-loading" role="status">
                  正在载入这一篇的正文…
                </p>
              ) : (
                <>
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
              )}
            </>
          ) : (
            <>
              <div className="overview-copy">
                {era.summary === undefined ? (
                  <p className="panel-loading" role="status">
                    正在载入时期概览…
                  </p>
                ) : (
                  era.summary
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((p, i) => <p key={i}>{p}</p>)
                )}
              </div>
              <section className="era-node-list">
                <h3>
                  {filterActive ? "符合偏好的历史节点" : "这一时期的历史节点"}{" "}
                  <small>{filteredNodes.length}</small>
                </h3>
                {filteredNodes.map((n) => (
                  <button key={n.id} onClick={() => onNode(n.id)}>
                    <span
                      className="node-type-dot"
                      style={{ background: TYPE_COLORS[n.type] }}
                    />
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {n.affiliations?.join(" · ") || n.type} · {n.dateLabel}
                      </small>
                    </span>
                    <span className="open-node-mark">＋</span>
                  </button>
                ))}
                {!filteredNodes.length && (
                  <div className="empty-interest">
                    <p>此时期暂未收录所选类别。</p>
                    <button onClick={onClearFilter}>显示全部节点</button>
                  </div>
                )}
              </section>
            </>
          )}
          <StoryNotes eraId={era.id} nodeId={node?.id} onNode={onNode} />
          <nav className="panel-learning-links" aria-label="继续系统学习">
            <a href={`/learn?kind=rulers&era=${era.id}`}>本时期君主世系</a>
            <a href={`/learn?kind=battles&era=${era.id}`}>战役档案</a>
            <a href={`/learn?kind=poets&era=${era.id}`}>诗人与作品</a>
          </nav>
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
          {!!item.sources?.length && (
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
