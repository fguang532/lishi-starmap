import type { Era, EraDetail } from "./types";

// history.json is never imported here. It is the authoring source compiled into
// /library/exploration.json, and inlining it would ship every article twice.
const INDEX_URL = "/library/exploration.json";
const detailUrl = (eraId: string) =>
  `/library/exploration/${encodeURIComponent(eraId)}.json`;

export const ERA_COUNT = 22;

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}

export async function loadEraIndex(signal?: AbortSignal): Promise<Era[]> {
  const value = await readJson<Era[]>(INDEX_URL, signal);
  if (!Array.isArray(value) || value.length !== ERA_COUNT)
    throw new Error("exploration index is incomplete");
  return value;
}

const detailCache = new Map<string, Promise<EraDetail>>();

export function loadEraDetail(eraId: string): Promise<EraDetail> {
  const cached = detailCache.get(eraId);
  if (cached) return cached;
  // Deliberately not passing a signal: the response is shared across callers and
  // cached, so one unmounted reader must not cancel it for everyone else.
  const pending = readJson<EraDetail>(detailUrl(eraId)).catch((error) => {
    detailCache.delete(eraId);
    throw error;
  });
  detailCache.set(eraId, pending);
  return pending;
}

/** Returns a new era with detail merged into its nodes and relations. */
export function mergeEraDetail(era: Era, detail: EraDetail): Era {
  const nodes = new Map(detail.nodes.map((n) => [n.id, n]));
  const relations = new Map(detail.relations.map((r) => [r.id, r]));
  return {
    ...era,
    summary: detail.summary,
    sources: detail.sources,
    nodes: era.nodes.map((n) => ({ ...n, ...nodes.get(n.id) })),
    relations: era.relations.map((r) => ({ ...r, ...relations.get(r.id) })),
  };
}
