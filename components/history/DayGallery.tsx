"use client";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  SlidersHorizontal,
  ChevronLeft,
  BookOpen,
} from "lucide-react";
import type { Era, HistoryNode } from "@/data/types";
import {
  historicalImages,
  imageForEra,
  matchesInterest,
  sortedEras,
  sortedNodes,
  TAG_LABELS,
  type SortMode,
} from "@/data/exploration";
import { ArtImage } from "./HeritageImage";
type Props = {
  eras: Era[];
  era?: Era;
  node?: HistoryNode;
  tags: string[];
  sort: SortMode;
  onEra: (id: string) => void;
  onNode: (id: string) => void;
  onGlobal: () => void;
  onPreferences: () => void;
  onOverview: () => void;
  onClear: () => void;
};
export default function DayGallery({
  eras,
  era,
  node,
  tags,
  sort,
  onEra,
  onNode,
  onGlobal,
  onPreferences,
  onOverview,
  onClear,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [era?.id]);
  const cover = era
    ? imageForEra(era.id)
    : historicalImages.find((im) => im.id === "image-ming-palace-hero");
  const list = era ? sortedNodes(era.nodes, tags, sort) : [];
  const selectionOutside = !!node && !list.some((n) => n.id === node.id);
  return (
    <div className="day-gallery" ref={scroller}>
      <div className={`day-cover ${era ? "day-cover-era" : ""}`}>
        <div className="day-cover-copy">
          <span className="day-kicker">
            <i>华夏</i>文明长卷 · {era ? era.englishTitle : "中国"}
          </span>
          {era && (
            <button className="day-back" onClick={onGlobal}>
              <ChevronLeft size={14} />
              返回全部朝代
            </button>
          )}
          <h1>
            {era ? (
              era.title
            ) : (
              <>
                山河入画<span>岁月成书</span>
              </>
            )}
          </h1>
          <p>
            {era
              ? era.dateLabel
              : "从文明初曙到帝制终章，循着人物、器物与故事，翻开五千年的历史。"}
          </p>
          <button
            className="day-primary"
            onClick={era ? onOverview : onPreferences}
          >
            {era ? <BookOpen size={16} /> : <SlidersHorizontal size={16} />}
            {era ? "阅读时期概览" : "选择我的历史偏好"}
            <ArrowUpRight size={16} />
          </button>
          <span className="day-cover-foot">
            {era
              ? `${list.length} 个${tags.length ? "匹配" : "历史"}入口 · 已接入历史学堂`
              : `${eras.length} 个历史专题 · 文明精选与学堂档案`}
          </span>
        </div>
        {cover && (
          <div className="day-cover-art">
            <ArtImage
              image={cover}
              eager
              sizes="(max-width: 767px) 100vw, 46vw"
            />
            <span className="cover-vertical-title">{cover.title}</span>
            <div className="cover-attribution">
              <a href={cover.sourceUrl} target="_blank" rel="noreferrer">
                {cover.id === "image-ming-palace-hero"
                  ? "Gisling 摄影 · 画面已裁切"
                  : `${cover.institution.split("（")[0]} · 查看图像来源`}{" "}
                ↗
              </a>
              {cover.id === "image-ming-palace-hero" && (
                <a
                  href="https://creativecommons.org/licenses/by/3.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}
                  · CC BY 3.0
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="day-section-heading">
        <div>
          <span>{era ? "人物 · 事件 · 文明" : "沿时序阅朝代"}</span>
          <h2>{era ? "这一卷的历史" : "二十二卷，五千年"}</h2>
        </div>
        <button onClick={onPreferences}>
          <SlidersHorizontal size={15} />
          {tags.length ? `${tags.length} 项偏好已选` : "筛选与排序"}
        </button>
      </div>
      {selectionOutside && (
        <p className="filter-notice">
          当前通过关联阅读的「{node.title}」不在筛选内。
          <button onClick={onClear}>显示全部节点</button>
        </p>
      )}
      {era ? (
        <div className="day-node-grid">
          {list.map((n, i) => (
            <button
              key={n.id}
              className={`day-node-card ${node?.id === n.id ? "active" : ""}`}
              onClick={() => onNode(n.id)}
            >
              <span className="day-node-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="day-node-type">
                {n.tags
                  ?.slice(0, 2)
                  .map((t) => TAG_LABELS[t])
                  .join(" · ") || n.type}
              </span>
              <strong>{n.title}</strong>
              {!!n.affiliations?.length && (
                <span className="academy-affiliation">
                  {n.affiliations.join(" · ")}
                </span>
              )}
              <small>{n.dateLabel}</small>
              <p>{n.summary}</p>
              <span className="day-card-link">
                翻阅档案 <ArrowUpRight size={15} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="day-era-grid">
          {sortedEras(eras, tags, sort).map((e) => {
            const im = imageForEra(e.id);
            return (
              <button
                key={e.id}
                className="day-era-card"
                onClick={() => onEra(e.id)}
                aria-label={`翻阅${e.title}`}
              >
                <div className="day-era-art">
                  {im && (
                    <ArtImage
                      image={im}
                      sizes="(max-width: 767px) 50vw, 320px"
                    />
                  )}
                  <span>
                    第{String(eras.indexOf(e) + 1).padStart(2, "0")}卷
                  </span>
                </div>
                <div className="day-era-text">
                  <small>{e.dateLabel}</small>
                  <strong>{e.title}</strong>
                  <p>{e.kicker}</p>
                  <span>
                    {e.nodes.filter((n) => matchesInterest(n, tags)).length} 个
                    {tags.length ? "匹配" : "历史"}节点{" "}
                    <ArrowUpRight size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {era && !list.length && (
        <div className="empty-interest">
          <h3>这一时期暂未收录这类内容</h3>
          <p>你可以调整偏好，或阅读本时期的全部档案。</p>
          <button onClick={onClear}>查看全部节点</button>
        </div>
      )}
      <p className="day-colophon">
        以史为卷，以物为证。图像年代与来源可在时期档案中查阅。
      </p>
    </div>
  );
}
