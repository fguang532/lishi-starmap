import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";
// Imported rather than read from disk: this runs on Workers at request time,
// where there is no filesystem. The index is the compiled list of every
// addressable topic and article, so the sitemap cannot drift from the content.
import explorationIndex from "../public/library/exploration.json";

type IndexEra = { id: string; nodes: { id: string }[] };

/** Lists every addressable view: both pages, each topic, and each article. */
export default function sitemap(): MetadataRoute.Sitemap {
  const eras = explorationIndex as IndexEra[];
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/learn`, lastModified: now, priority: 0.9 },
    ...eras.map((era) => ({
      url: `${SITE_URL}/?era=${encodeURIComponent(era.id)}`,
      lastModified: now,
      priority: 0.8,
    })),
    ...eras.flatMap((era) =>
      era.nodes.map((node) => ({
        url: `${SITE_URL}/?era=${encodeURIComponent(era.id)}&node=${encodeURIComponent(node.id)}`,
        lastModified: now,
        priority: 0.6,
      })),
    ),
  ];
}
