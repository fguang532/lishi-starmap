/**
 * Canonical origin used for metadata, sitemap and share cards.
 *
 * Set SITE_URL at build time once a domain is attached; the fallback only keeps
 * absolute URLs well-formed in local and preview builds.
 */
export const SITE_URL = (
  process.env.SITE_URL ?? "https://huaxia-starmap.example"
).replace(/\/$/, "");
