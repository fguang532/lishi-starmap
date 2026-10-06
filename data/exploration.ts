import type { Era, HistoryNode, HistoricalImage, Anecdote } from "./types";
import imageData from "./images.json";
import anecdoteData from "./anecdotes.json";

export const historicalImages = imageData as HistoricalImage[];
export const anecdotes = anecdoteData as Anecdote[];
export const INTEREST_GROUPS = [
  {
    id: "court",
    title: "帝王与大臣",
    mark: "权",
    tags: ["emperor", "minister", "politician"],
  },
  { id: "events", title: "大事与战役", mark: "史", tags: ["event", "battle"] },
  {
    id: "people",
    title: "名人与诗人",
    mark: "人",
    tags: ["poet", "thinker", "artist"],
  },
  {
    id: "arts",
    title: "作品与艺术",
    mark: "艺",
    tags: ["literature", "painting", "artifact"],
  },
  {
    id: "life",
    title: "制度与文明",
    mark: "世",
    tags: ["institution", "society", "archaeology"],
  },
];
export const TAG_LABELS: Record<string, string> = {
  emperor: "帝王",
  minister: "大臣",
  politician: "政治家",
  poet: "诗人",
  thinker: "思想与学术",
  artist: "艺术家",
  event: "重大事件",
  battle: "战争与战役",
  literature: "文学与典籍",
  painting: "书法与绘画",
  artifact: "器物与工艺",
  institution: "制度",
  society: "社会生活",
  archaeology: "遗址与考古",
};
export type SortMode = "chronological" | "reverse" | "relevance";
export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "chronological", label: "年代：从早到晚" },
  { value: "reverse", label: "年代：从晚到早" },
  { value: "relevance", label: "偏好匹配优先" },
];
export function matchesInterest(node: HistoryNode, tags: string[]) {
  return tags.length === 0 || tags.some((tag) => node.tags?.includes(tag));
}
export function sortedNodes(
  nodes: HistoryNode[],
  tags: string[],
  mode: SortMode,
) {
  return nodes
    .filter((n) => matchesInterest(n, tags))
    .slice()
    .sort((a, b) => {
      if (mode === "relevance") {
        const score = (n: HistoryNode) =>
          tags.filter((t) => n.tags?.includes(t)).length;
        const delta = score(b) - score(a);
        if (delta) return delta;
      }
      const direction = mode === "reverse" ? -1 : 1;
      // Many early rulers share a borrowed startYear because no absolute date is
      // established. Documented succession order keeps them in a readable order
      // instead of collapsing to an alphabetical ID sort.
      return (
        direction * (a.startYear - b.startYear) ||
        (a.seq !== undefined && b.seq !== undefined
          ? direction * (a.seq - b.seq)
          : 0) ||
        a.id.localeCompare(b.id)
      );
    });
}
export function sortedEras(eras: Era[], tags: string[], mode: SortMode) {
  return eras
    .filter((e) => e.nodes.some((n) => matchesInterest(n, tags)))
    .slice()
    .sort((a, b) => {
      if (mode === "relevance") {
        const count = (e: Era) =>
          e.nodes.filter((n) => matchesInterest(n, tags)).length;
        const delta = count(b) - count(a);
        if (delta) return delta;
      }
      return (mode === "reverse" ? -1 : 1) * (a.startYear - b.startYear);
    });
}
export function imageForEra(id: string) {
  return (
    historicalImages.find((im) => im.id === `image-${id}`) ??
    historicalImages.find((im) => im.eraIds.includes(id))
  );
}
export function imagesFor(eraId: string, nodeId?: string) {
  const exact = nodeId
    ? historicalImages.filter((im) => im.nodeIds.includes(nodeId))
    : [];
  return exact.length
    ? exact
    : historicalImages.filter((im) => im.eraIds.includes(eraId)).slice(0, 1);
}
