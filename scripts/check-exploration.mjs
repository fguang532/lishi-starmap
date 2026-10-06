import fs from "node:fs";
import assert from "node:assert/strict";
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const index = read("public/library/exploration.json");
const catalog = read("public/library/catalog.json");
const original = read("data/history.json");
// The client reads the index first and merges a per-era detail file on demand.
// Checking the merged shape is the only way to test what a reader actually sees.
const eras = index.map(era => {
  const detail = read(`public/library/exploration/${era.id}.json`);
  const nodes = new Map(detail.nodes.map(n => [n.id, n]));
  const relations = new Map(detail.relations.map(r => [r.id, r]));
  assert.equal(detail.nodes.length, era.nodes.length, `${era.id}: detail node count`);
  assert.equal(detail.relations.length, era.relations.length, `${era.id}: detail relation count`);
  return {
    ...era,
    summary: detail.summary,
    sources: detail.sources,
    nodes: era.nodes.map(n => {
      assert(nodes.has(n.id), `${n.id}: missing detail entry`);
      return { ...n, ...nodes.get(n.id) };
    }),
    relations: era.relations.map(r => ({ ...r, ...relations.get(r.id) })),
  };
});
const nodes = eras.flatMap(e => e.nodes);
const ids = new Set(nodes.map(n => n.id));
assert.equal(ids.size, nodes.length, "Cross-era node IDs must stay unique");
assert.equal(eras.length, 22);
const archiveIds = new Set(nodes.flatMap(n => (n.archives || []).map(a => a.id)));
assert.deepEqual([...archiveIds].sort(), catalog.records.map(r => r.id).sort(), "Every academy archive must remain reachable");
for (const era of eras) {
  assert(era.summary && era.sources.length, `${era.id}: missing era detail`);
  assert(original.find(e => e.id === era.id).nodes.every(n => era.nodes.some(x => x.id === n.id)), "Preserve original node links");
  const inEra = era.nodes.flatMap(n => (n.archives || []).map(a => a.id));
  assert.equal(new Set(inEra).size, inEra.length, `Duplicate archive in ${era.id}`);
  for (const edge of era.relations) assert(ids.has(edge.source) && ids.has(edge.target) && edge.sourceUrl, `Broken relation ${edge.id}`);
  for (const n of era.nodes) {
    for (const r of n.relatedReading || []) assert(ids.has(r.id) && r.id !== n.id);
    assert(n.sources.length && n.summary && n.background && n.story && n.legacy, `Incomplete ${n.id}`);
    for (const a of n.archives || []) assert(fs.existsSync(`public/library/archive/${a.id}.json`));
  }
}
// A curated node keeps the startYear that matches its own dateLabel; sortYear is
// an accession year and must not silently replace a birth year.
const curated = new Map(original.flatMap(e => e.nodes).map(n => [n.id, n]));
for (const n of nodes) {
  const before = curated.get(n.id);
  if (before) assert.equal(n.startYear, before.startYear, `${n.id}: curated startYear changed`);
}
// Rulers sharing a borrowed year must still carry a documented order, otherwise
// the reading list collapses into an alphabetical ID sort.
for (const era of eras) {
  const byYear = new Map();
  for (const n of era.nodes) byYear.set(n.startYear, [...(byYear.get(n.startYear) || []), n]);
  for (const [year, tied] of byYear) {
    const rulers = tied.filter(n => n.archives?.some(a => a.kind === "rulers"));
    if (rulers.length < 2) continue;
    const ordered = rulers.filter(n => Number.isInteger(n.seq));
    assert.equal(ordered.length, rulers.length, `${era.id}: rulers tied at ${year} without seq`);
    assert.equal(new Set(ordered.map(n => n.seq)).size, ordered.length, `${era.id}: duplicate seq at ${year}`);
  }
}
const han = eras.find(e => e.id === "western-han");
const emperors = han.nodes.filter(n => n.tags?.includes("emperor"));
assert.equal(emperors.length, 14, "Western Han should include exactly 14 actual rulers");
const expected = new Set(catalog.polities.find(p => p.id === "polity-western-han").reigns.map(t => t.rulerId));
assert.deepEqual(new Set(emperors.flatMap(n => n.archives.map(a => a.id))), expected);
const regent = han.nodes.find(n => n.terms?.some(t => t.title.includes("吕") || t.note.includes("吕后")) && !n.tags?.includes("emperor"));
assert(regent, "Keep regency separate from imperial accession");
for (const [eraId, nodeId, archiveId] of [
  ["three-kingdoms", "three-kingdoms-cao-pi", "poet-cao-pi"],
  ["five-dynasties", "five-dynasties-li-yu", "poet-li-yu"],
]) {
  const node = eras.find(e => e.id === eraId).nodes.find(n => n.id === nodeId);
  assert(node.archives.some(a => a.id === archiveId) && node.archives.some(a => a.kind === "rulers"));
}
// The index is the first-screen payload and must stay free of article bodies.
const indexBytes = fs.statSync("public/library/exploration.json").size;
for (const era of index)
  for (const n of era.nodes)
    assert(n.background === undefined && n.sources === undefined, `${n.id}: index carries detail fields`);
assert(indexBytes < 512 * 1024, `index too large: ${Math.round(indexBytes / 1024)}KB`);
console.log(JSON.stringify({
  eras: eras.length,
  entries: nodes.length,
  archives: archiveIds.size,
  westernHanRulers: emperors.length,
  indexKb: Math.round(indexBytes / 1024),
  errors: [],
}));
