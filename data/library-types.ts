import type { Source } from "./types";

export type LibraryKind = "rulers" | "battles" | "poets";
export type ArchiveSection = { title: string; text: string };
export type ArchiveEvent = {
  dateLabel: string;
  year: number | null;
  title: string;
  text: string;
  sourceUrl: string;
};
export type ArchiveWork = {
  title: string;
  genre: string;
  dateLabel: string;
  text: string;
  context: string;
  analysis: string;
  source: Source;
};
export type ArchiveRecord = {
  id: string;
  kind: LibraryKind;
  name: string;
  title: string;
  aliases: string[];
  lifeLabel: string;
  certainty: string;
  summary: string;
  sections: ArchiveSection[];
  timeline: ArchiveEvent[];
  sources: Source[];
  legacyNodeIds: string[];
  eraIds: string[];
  facts?: { label: string; value: string }[];
  works?: ArchiveWork[];
  relatedIds?: string[];
};
export type Reign = {
  id: string;
  rulerId: string;
  rulerName?: string;
  title: string;
  dateLabel: string;
  startYear: number | null;
  endYear: number | null;
  predecessorIds: string[];
  succession: string;
  note: string;
  sourceUrl: string;
};
export type Polity = {
  id: string;
  title: string;
  eraIds: string[];
  startYear: number | null;
  endYear: number | null;
  sortYear: number;
  scopeNote: string;
  sources: Source[];
  reigns: Reign[];
  regencies?: (Reign & { role: string })[];
};
export type ArchiveIndex = Pick<
  ArchiveRecord,
  | "id"
  | "kind"
  | "name"
  | "title"
  | "aliases"
  | "lifeLabel"
  | "summary"
  | "eraIds"
> & { polityIds: string[]; sortYear: number; searchText: string; file: string };
export type LibraryCatalog = {
  version: string;
  scopeNote: string;
  eras: { id: string; title: string; startYear: number }[];
  polities: Polity[];
  records: ArchiveIndex[];
};
