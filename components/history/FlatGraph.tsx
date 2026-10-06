"use client";
import type { Era } from "@/data/types";
import { eraColor, TYPE_COLORS } from "@/data/types";
type Props = {
  eras: Era[];
  eraId: string | null;
  nodeId: string | null;
  onEra: (id: string) => void;
  onNode: (id: string) => void;
  matchingIds: string[] | null;
};
export default function FlatGraph({
  eras,
  eraId,
  nodeId,
  onEra,
  onNode,
  matchingIds,
}: Props) {
  const era = eras.find((e) => e.id === eraId);
  const list = era ? era.nodes : eras;
  const points = list.map((_, i) => {
    const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 36, y: 50 + Math.sin(a) * 34 };
  });
  const relations = era?.relations ?? [];
  const shown = (id: string) =>
    !era || !matchingIds || matchingIds.includes(id) || id === nodeId;
  return (
    <div className={`flat-graph ${era ? "flat-detail" : "flat-overview"}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse
          cx="50"
          cy="50"
          rx="36"
          ry="34"
          fill="none"
          stroke="#425879"
          strokeWidth=".18"
          strokeDasharray=".4 .8"
        />
        {relations.map((r) => {
          const a = list.findIndex((n) => n.id === r.source),
            b = list.findIndex((n) => n.id === r.target);
          if (a < 0 || b < 0 || !shown(r.source) || !shown(r.target))
            return null;
          return (
            <line
              key={r.id}
              x1={points[a].x}
              y1={points[a].y}
              x2={points[b].x}
              y2={points[b].y}
              stroke="#75b9d1"
              strokeWidth=".2"
              opacity=".6"
            />
          );
        })}
      </svg>
      <div className="flat-core">
        <span>{era?.shortTitle ?? "中国"}</span>
        <small>{era ? "历史关系网" : "文明的轨迹"}</small>
      </div>
      {list.map((n, i) =>
        shown(n.id) ? (
          <button
            className={`flat-node ${nodeId === n.id ? "active" : ""}`}
            key={n.id}
            style={
              {
                left: `${points[i].x}%`,
                top: `${points[i].y}%`,
                "--node-color": era
                  ? TYPE_COLORS[era.nodes[i].type]
                  : eraColor(i),
              } as React.CSSProperties
            }
            onClick={() => (era ? onNode(n.id) : onEra(n.id))}
          >
            <i />
            <span>{"shortTitle" in n ? n.shortTitle : n.title}</span>
            {era && <small>{era.nodes[i].type}</small>}
          </button>
        ) : null,
      )}
    </div>
  );
}
