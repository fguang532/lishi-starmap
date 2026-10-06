import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const base = path.resolve("data/library");
const files = fs
  .readdirSync(base)
  .filter((f) => f.endsWith(".json") && f !== "coverage.json")
  .sort();
const groups = files.map((f) =>
  JSON.parse(fs.readFileSync(path.join(base, f), "utf8")),
);
const eras = JSON.parse(fs.readFileSync("data/history.json", "utf8"));
const polities = groups
  .flatMap((g) => g.polities || [])
  .map((p) => ({
    ...p,
    country: "CN",
    sortYear:
      p.startYear ??
      Math.min(
        ...eras.filter((e) => p.eraIds.includes(e.id)).map((e) => e.startYear),
      ),
  }));
const raw = groups.flatMap((g) => [
  ...(g.rulers || []).map((r) => ({ ...r, kind: "rulers" })),
  ...(g.poets || []).map((r) => ({ ...r, kind: "poets" })),
  ...(g.battles || []).map((r) => ({ ...r, kind: "battles" })),
]);
const unique = new Map();
for (const r of raw) {
  if (unique.has(r.id)) throw new Error(`Duplicate record ${r.id}`);
  unique.set(r.id, r);
}
const terms = (p) => [...p.reigns, ...(p.regencies || [])];
const namesOf = (r) => [
  r.name,
  r.title,
  ...(r.aliases || []),
  r.name.split(/[·•]/).at(-1),
];
const records = [...unique.values()].map((r) => {
  const relatedPolities = polities.filter((p) =>
    terms(p).some((x) => x.rulerId === r.id),
  );
  const reigns = relatedPolities.flatMap((p) =>
    terms(p).filter((x) => x.rulerId === r.id),
  );
  const eraIds = [
    ...new Set([
      ...(r.eraIds || []),
      ...relatedPolities.flatMap((p) =>
        p.eraIds.length === 1
          ? p.eraIds
          : p.eraIds.filter((id) => {
              const era = eras.find((e) => e.id === id);
              return (
                era &&
                terms(p).some(
                  (term) =>
                    term.rulerId === r.id &&
                    (term.startYear === null ||
                      term.endYear === null ||
                      (term.startYear <= era.endYear &&
                        term.endYear >= era.startYear)),
                )
              );
            }),
      ),
    ]),
  ];
  const knownYears = reigns
    .map((x) => x.startYear)
    .filter((v) => typeof v === "number");
  const sortYear =
    r.sortYear ??
    (knownYears.length
      ? Math.min(...knownYears)
      : Math.min(...relatedPolities.map((p) => p.sortYear)));
  const legacyNodeIds = [
    ...new Set([
      ...(r.legacyNodeIds || []),
      ...eras.flatMap((e) =>
        e.nodes
          .filter(
            (n) =>
              n.type === "人物" &&
              n.title.includes(r.name) &&
              r.name.length >= 2,
          )
          .map((n) => n.id),
      ),
    ]),
  ];
  const relatedIds = [
    ...new Set([
      ...(r.relatedIds || []),
      ...raw
        .filter(
          (other) =>
            other.id !== r.id &&
            (namesOf(other).some((n) => (r.relatedNames || []).includes(n)) ||
              (r.kind === "rulers" &&
                other.kind === "poets" &&
                r.name === other.name)),
        )
        .map((other) => other.id),
    ]),
  ];
  return {
    ...r,
    country: "CN",
    eraIds,
    sortYear,
    legacyNodeIds,
    relatedIds,
    polityIds: relatedPolities.map((p) => p.id),
  };
});
for (const r of records) {
  for (const id of r.relatedIds) {
    const other = records.find((x) => x.id === id);
    if (other && !other.relatedIds.includes(r.id)) other.relatedIds.push(r.id);
  }
}
const errors = [];
const ids = new Set(records.map((r) => r.id));
const polityIds = new Set();
const reignIds = new Set(polities.flatMap((p) => terms(p).map((r) => r.id)));
const validEra = new Set(eras.map((e) => e.id));
const ok = (b, m) => {
  if (!b) errors.push(m);
};
const source = (s, id) => {
  try {
    ok(
      !!s.title && !!s.institution && new URL(s.url).protocol === "https:",
      `${id}: source`,
    );
  } catch {
    errors.push(`${id}: source URL`);
  }
};
for (const p of polities) {
  ok(!polityIds.has(p.id), `duplicate polity ${p.id}`);
  polityIds.add(p.id);
  ok(
    terms(p).length > 0 && p.scopeNote && p.title,
    `${p.id}: missing polity detail`,
  );
  ok(
    p.eraIds.length && p.eraIds.every((e) => validEra.has(e)),
    `${p.id}: era references`,
  );
  ok(
    [p.startYear, p.endYear].every(
      (y) => y === null || (Number.isFinite(y) && y !== 0),
    ) &&
      (p.startYear === null || p.endYear === null || p.startYear <= p.endYear),
    `${p.id}: dates`,
  );
  ok(p.sources.length > 0, `${p.id}: no source`);
  p.sources.forEach((s) => source(s, p.id));
  for (const r of terms(p)) {
    r.rulerName = unique.get(r.rulerId)?.name;
    ok(ids.has(r.rulerId), `${r.id}: missing ruler ${r.rulerId}`);
    ok(
      r.predecessorIds.every((id) => reignIds.has(id) && id !== r.id),
      `${r.id}: predecessor reference`,
    );
    ok(
      [r.startYear, r.endYear].every(
        (y) => y === null || (Number.isFinite(y) && y !== 0),
      ) &&
        (r.startYear === null ||
          r.endYear === null ||
          r.startYear <= r.endYear),
      `${r.id}: reign dates`,
    );
    ok(
      r.title && r.dateLabel && r.note && r.succession && r.sourceUrl,
      `${r.id}: missing reign detail`,
    );
    try {
      ok(
        new URL(r.sourceUrl).protocol === "https:",
        `${r.id}: succession source URL`,
      );
    } catch {
      errors.push(`${r.id}: succession source URL`);
    }
  }
  ok(
    (p.regencies || []).every((r) => r.role),
    `${p.id}: regency role`,
  );
}
ok(
  reignIds.size === polities.reduce((n, p) => n + terms(p).length, 0),
  "duplicate reign IDs",
);
const termMap = new Map(
  polities.flatMap((p) => terms(p).map((r) => [r.id, r])),
);
const visited = new Set(),
  active = new Set();
function checkSuccession(id) {
  if (active.has(id)) {
    errors.push(`${id}: cyclic succession`);
    return;
  }
  if (visited.has(id) || !termMap.has(id)) return;
  active.add(id);
  termMap.get(id).predecessorIds.forEach(checkSuccession);
  active.delete(id);
  visited.add(id);
}
reignIds.forEach(checkSuccession);
for (const r of records) {
  ok(/^[a-z0-9-]+$/.test(r.id), `${r.id}: unsafe ID`);
  ok(
    r.name && r.title && r.lifeLabel && r.summary && r.certainty,
    `${r.id}: missing identity`,
  );
  ok(
    r.eraIds.length && r.eraIds.every((e) => validEra.has(e)),
    `${r.id}: era references`,
  );
  ok(Number.isFinite(r.sortYear) && r.sortYear !== 0, `${r.id}: sorting year`);
  ok(
    r.sections.length >= 3 && r.sections.every((s) => s.title && s.text),
    `${r.id}: incomplete biography`,
  );
  ok(
    r.timeline.length >= 2 &&
      r.timeline.every((t) => t.title && t.text && t.dateLabel && t.sourceUrl),
    `${r.id}: timeline`,
  );
  ok(
    r.timeline.every(
      (t) => t.year === null || (Number.isFinite(t.year) && t.year !== 0),
    ),
    `${r.id}: invalid event year`,
  );
  const chronological = r.timeline
    .filter((t) => t.year !== null)
    .map((t) => t.year);
  ok(
    chronological.every((year, i) => i === 0 || year >= chronological[i - 1]),
    `${r.id}: events out of order`,
  );
  for (const event of r.timeline) {
    try {
      ok(
        new URL(event.sourceUrl).protocol === "https:",
        `${r.id}: event source URL`,
      );
    } catch {
      errors.push(`${r.id}: event source URL`);
    }
  }
  ok(r.sources.length > 0, `${r.id}: no sources`);
  r.sources.forEach((s) => source(s, r.id));
  ok(
    r.relatedIds.every((id) => ids.has(id) && id !== r.id),
    `${r.id}: related record reference`,
  );
  if (r.kind === "poets") {
    ok(r.works?.length > 0, `${r.id}: missing works`);
    for (const w of r.works || []) {
      ok(
        w.text && w.analysis && w.context && w.dateLabel && w.genre,
        `${r.id}/${w.title}: incomplete work`,
      );
      source(w.source, r.id);
    }
  }
  if (r.kind === "battles") ok(r.facts?.length >= 4, `${r.id}: battle facts`);
}
if (errors.length) {
  console.error(JSON.stringify({ errors }, null, 2));
  process.exit(1);
}
const target = path.resolve("public/library");
fs.mkdirSync(path.join(target, "archive"), { recursive: true });
for (const file of fs.readdirSync(path.join(target, "archive"))) {
  if (file.endsWith(".json") && !ids.has(file.slice(0, -5)))
    fs.unlinkSync(path.join(target, "archive", file));
}
for (const r of records)
  fs.writeFileSync(
    path.join(target, "archive", `${r.id}.json`),
    JSON.stringify(r) + "\n",
  );
const index = records.map((r) => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  title: r.title,
  aliases: r.aliases,
  lifeLabel: r.lifeLabel,
  summary: r.summary,
  eraIds: r.eraIds,
  polityIds: r.polityIds,
  sortYear: r.sortYear,
  searchText: [
    ...(r.aliases || []),
    ...(r.works || []).flatMap((w) => [w.title, w.text]),
    ...(r.facts || []).map((f) => f.value),
  ].join(" "),
  file: `/library/archive/${r.id}.json`,
}));
const version = crypto
  .createHash("sha256")
  .update(JSON.stringify({ polities, records }))
  .digest("hex")
  .slice(0, 12);
const scopeNote =
  "君主名录按夏商周王室、秦汉以后各王朝及所列并立政权整理，实际在位、复位、争立与监国分开注明。周代诸侯、地方短命称王者及史料分歧见各政权收录说明，不把传说年代写成确定年份。战役与诗人采用明确列出的重要事件和代表人物，不能代替全部历史文献。古代作品展示公有领域原文，传记、背景与赏析为依据列明资料整理。";
fs.writeFileSync(
  path.join(target, "catalog.json"),
  JSON.stringify({
    version,
    scopeNote,
    eras: eras.map(({ id, title, startYear }) => ({ id, title, startYear })),
    polities,
    records: index,
  }) + "\n",
);
const counts = {
  polities: polities.length,
  rulers: records.filter((r) => r.kind === "rulers").length,
  reigns: polities.reduce((n, p) => n + p.reigns.length, 0),
  regencies: polities.reduce((n, p) => n + (p.regencies?.length || 0), 0),
  battles: records.filter((r) => r.kind === "battles").length,
  poets: records.filter((r) => r.kind === "poets").length,
  works: records.reduce((n, r) => n + (r.works?.length || 0), 0),
  version,
};
console.log(JSON.stringify({ ...counts, errors: [] }, null, 2));
