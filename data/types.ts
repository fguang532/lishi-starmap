export type Source = { title: string; url: string; institution: string };
export type ArchiveLink = {
  id: string;
  kind: "rulers" | "battles" | "poets";
  title: string;
};
export type ReignTerm = {
  title: string;
  polity: string;
  dateLabel: string;
  note: string;
  sourceUrl: string;
};
/** Fields the star map needs to draw and filter a node. Always loaded. */
export type NodeIndex = {
  id: string;
  title: string;
  type: "人物" | "事件" | "制度" | "文化" | "遗址" | "政权";
  dateLabel: string;
  startYear: number;
  endYear: number;
  certainty: "史实" | "约年" | "传说" | "有争议";
  summary: string;
  tags?: string[];
  affiliations?: string[];
  /** Documented order inside a polity; breaks ties when rulers share a sortYear. */
  seq?: number;
};
/** Article body, evidence and reign records. Fetched when a topic is opened. */
export type NodeDetail = {
  id: string;
  background: string;
  story: string;
  legacy: string;
  sources: Source[];
  archives?: ArchiveLink[];
  terms?: ReignTerm[];
  relatedReading?: { id: string; title: string }[];
};
/** An index node, enriched in place once its era detail has been loaded. */
export type HistoryNode = NodeIndex & Partial<Omit<NodeDetail, "id">>;
export type RelationIndex = {
  id: string;
  source: string;
  target: string;
  type: string;
};
export type Relation = RelationIndex & {
  explanation?: string;
  sourceUrl?: string;
};
export type Era = {
  id: string;
  country: string;
  title: string;
  shortTitle: string;
  englishTitle: string;
  startYear: number;
  endYear: number;
  dateLabel: string;
  kicker: string;
  summary?: string;
  sources?: Source[];
  nodes: HistoryNode[];
  relations: Relation[];
};
/** Shape of /library/exploration/{eraId}.json */
export type EraDetail = {
  id: string;
  summary: string;
  sources: Source[];
  nodes: NodeDetail[];
  relations: { id: string; explanation: string; sourceUrl: string }[];
};
export type ViewState = { eraId: string | null; nodeId: string | null };
export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};
export type ThemeMode = "night" | "day";
export type HistoricalImage = {
  id: string;
  eraIds: string[];
  nodeIds: string[];
  title: string;
  dating: string;
  caption: string;
  imageUrl: string;
  localSrc: string;
  sourceUrl: string;
  institution: string;
  credit: string;
  license: string;
  alt: string;
};
export type Anecdote = {
  id: string;
  eraId: string;
  nodeIds: string[];
  title: string;
  text: string;
  evidenceLabel: string;
  source: Source;
};
export const ERA_COLORS = [
  "#67e8f9",
  "#56ccf2",
  "#659bf7",
  "#9184ff",
  "#b798ff",
];
export const TYPE_COLORS: Record<HistoryNode["type"], string> = {
  人物: "#a993ff",
  事件: "#62dafa",
  制度: "#74e2c6",
  文化: "#efb56e",
  遗址: "#87b8ed",
  政权: "#ed8fbc",
};
export const eraColor = (index: number) =>
  ERA_COLORS[Math.min(4, Math.floor(index / 5))];
