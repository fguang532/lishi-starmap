import fs from "node:fs";
import assert from "node:assert/strict";
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const eras = read("public/library/exploration.json");
const catalog = read("public/library/catalog.json");
const original = read("data/history.json");
const nodes = eras.flatMap(e => e.nodes);
const ids = new Set(nodes.map(n => n.id));
assert.equal(ids.size, nodes.length, "Cross-era node IDs must stay unique");
assert.equal(eras.length, 22);
const archiveIds = new Set(nodes.flatMap(n => (n.archives || []).map(a => a.id)));
assert.deepEqual([...archiveIds].sort(), catalog.records.map(r => r.id).sort(), "Every academy archive must remain reachable");
for (const era of eras) {
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
console.log(JSON.stringify({ eras: eras.length, entries: nodes.length, archives: archiveIds.size, westernHanRulers: emperors.length, errors: [] }));
