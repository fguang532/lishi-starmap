"use client";
import { X, Check, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  INTEREST_GROUPS,
  TAG_LABELS,
  SORT_OPTIONS,
  sortedEras,
  matchesInterest,
  type SortMode,
} from "@/data/exploration";
import type { Era } from "@/data/types";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  eras: Era[];
  onEra: (id: string) => void;
};
export default function Preferences({
  open,
  onOpenChange,
  tags,
  onTags,
  sort,
  onSort,
  eras,
  onEra,
}: Props) {
  const results = sortedEras(eras, tags, sort);
  const count = results.reduce(
    (sum, e) => sum + e.nodes.filter((n) => matchesInterest(n, tags)).length,
    0,
  );
  const toggle = (tag: string) =>
    onTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="preferences-panel"
        showCloseButton={false}
      >
        <div className="preferences-heading">
          <div>
            <span className="eyebrow">
              <SlidersHorizontal size={14} /> EXPLORE YOUR WAY
            </span>
            <SheetTitle>从你的兴趣出发</SheetTitle>
            <SheetDescription>
              多选喜欢的类别，沿人物、事件与作品看朝代。
            </SheetDescription>
          </div>
          <button
            className="panel-icon"
            aria-label="关闭探索偏好"
            onClick={() => onOpenChange(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="preferences-scroll">
          <div className="preference-reset">
            <span>选择任一标签即可匹配</span>
            <button
              onClick={() => {
                onTags([]);
                onSort("chronological");
              }}
            >
              重置偏好
            </button>
          </div>
          {INTEREST_GROUPS.map((group) => (
            <section className="interest-group" key={group.id}>
              <div>
                <span className="interest-seal">{group.mark}</span>
                <h3>{group.title}</h3>
                <button
                  onClick={() =>
                    onTags(
                      group.tags.every((t) => tags.includes(t))
                        ? tags.filter((t) => !group.tags.includes(t))
                        : [...new Set([...tags, ...group.tags])],
                    )
                  }
                >
                  {group.tags.every((t) => tags.includes(t))
                    ? "取消本组"
                    : "选择本组"}
                </button>
              </div>
              <div className="interest-tags">
                {group.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggle(tag)}
                    aria-pressed={tags.includes(tag)}
                  >
                    {tags.includes(tag) && <Check size={13} />}
                    {TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <label className="sort-control">
            <span>
              <ArrowUpDown size={15} />
              排列顺序
            </span>
            <select
              aria-label="排序方式"
              value={sort}
              onChange={(e) => onSort(e.target.value as SortMode)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="preference-hint">
            偏好保存在当前浏览器。图谱保留固定位置；下方专题与阅读列表按所选顺序排列。
          </p>
          <div className="preference-results">
            <h3>
              与你的兴趣相遇{" "}
              <small>
                {results.length} 个专题 · {count} 个节点
              </small>
            </h3>
            {results.map((era) => (
              <button
                key={era.id}
                onClick={() => {
                  onEra(era.id);
                  onOpenChange(false);
                }}
              >
                <div>
                  <strong>{era.title}</strong>
                  <small>{era.dateLabel}</small>
                </div>
                <span>
                  {era.nodes.filter((n) => matchesInterest(n, tags)).length}{" "}
                  个节点 →
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          className="preferences-done"
          onClick={() => onOpenChange(false)}
        >
          带着偏好继续探索 <span>{count}</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
