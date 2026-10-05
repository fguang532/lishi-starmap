export type Source = { title: string; url: string; institution: string };
export type HistoryNode = {
  id: string;
  title: string;
  type: "人物" | "事件" | "制度" | "文化" | "遗址" | "政权";
  dateLabel: string;
  startYear: number;
  endYear: number;
  certainty: "史实" | "约年" | "传说" | "有争议";
  summary: string;
  background: string;
  story: string;
  legacy: string;
  sources: Source[];
};
export type Relation = {
  id: string;
  source: string;
  target: string;
  type: string;
  explanation: string;
  sourceUrl: string;
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
  summary: string;
  sources: Source[];
  nodes: HistoryNode[];
  relations: Relation[];
};
export type ViewState = { eraId: string | null; nodeId: string | null };
export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
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
