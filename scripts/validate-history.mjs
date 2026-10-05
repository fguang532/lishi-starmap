import fs from "node:fs";
const file = process.argv[2];
if (!file) throw new Error("Provide a history JSON path");
const eras = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
const ids = new Set();
const all = new Map();
const sourceURLs = new Set();
let relations = 0;
let sources = 0;
const cjk = (t) => (t.match(/[\u3400-\u9fff]/g) || []).length;
const ok = (condition, message) => {
  if (!condition) errors.push(message);
};
const sourcesCheck = (list, id) => {
  ok(Array.isArray(list) && list.length > 0, `${id}: missing sources`);
  for (const s of list || []) {
    ok(!!s.title && !!s.institution, `${id}: incomplete source`);
    try {
      ok(
        ["https:", "http:"].includes(new URL(s.url).protocol),
        `${id}: bad source protocol`,
      );
      sourceURLs.add(s.url);
      sources++;
    } catch {
      errors.push(`${id}: bad source URL`);
    }
  }
};
ok(eras.length === 22, `Expected 22 eras, found ${eras.length}`);
ok(
  eras.every((e, i) => i === 0 || e.startYear >= eras[i - 1].startYear),
  "Eras must be sorted by starting date (overlaps are allowed)",
);
for (const e of eras) {
  ok(!ids.has(e.id), `Duplicate ID ${e.id}`);
  ids.add(e.id);
  ok(
    e.startYear <= e.endYear && e.startYear !== 0 && e.endYear !== 0,
    `${e.id}: bad dates`,
  );
  ok(
    cjk(e.summary) >= 400 && cjk(e.summary) <= 600,
    `${e.id}: overview has ${cjk(e.summary)} Chinese characters`,
  );
  ok(e.country === "china", `${e.id}: missing country`);
  ok(!!e.title && !!e.dateLabel && !!e.kicker, `${e.id}: incomplete overview`);
  ok(e.nodes.length >= 8, `${e.id}: requires 8 nodes`);
  sourcesCheck(e.sources, e.id);
  for (const n of e.nodes) {
    ok(!ids.has(n.id), `Duplicate ID ${n.id}`);
    ids.add(n.id);
    all.set(n.id, n);
    ok(
      n.startYear <= n.endYear && n.startYear !== 0 && n.endYear !== 0,
      `${n.id}: bad dates`,
    );
    ok(
      ["人物", "事件", "制度", "文化", "遗址", "政权"].includes(n.type),
      `${n.id}: invalid type`,
    );
    ok(
      ["史实", "约年", "传说", "有争议"].includes(n.certainty),
      `${n.id}: invalid certainty`,
    );
    const len = cjk(n.background + n.story + n.legacy);
    ok(
      len >= 200 && len <= 400,
      `${n.id}: details have ${len} Chinese characters`,
    );
    ok(
      !!n.title &&
        !!n.dateLabel &&
        !!n.summary &&
        !!n.background &&
        !!n.story &&
        !!n.legacy,
      `${n.id}: incomplete details`,
    );
    sourcesCheck(n.sources, n.id);
  }
}
const edgeIds = new Set();
for (const e of eras) {
  for (const r of e.relations) {
    relations++;
    ok(!edgeIds.has(r.id), `Duplicate relation ${r.id}`);
    edgeIds.add(r.id);
    ok(all.has(r.source) && all.has(r.target), `${r.id}: dangling endpoint`);
    ok(r.source !== r.target, `${r.id}: self relation`);
    ok(
      !!r.type && !!r.explanation && !!r.sourceUrl,
      `${r.id}: incomplete evidence`,
    );
    try {
      ok(
        ["https:", "http:"].includes(new URL(r.sourceUrl).protocol),
        `${r.id}: invalid relation source protocol`,
      );
    } catch {
      errors.push(`${r.id}: invalid source URL`);
    }
    const a = all.get(r.source),
      b = all.get(r.target);
    if (r.type === "并存" && a && b)
      ok(
        Math.max(a.startYear, b.startYear) <= Math.min(a.endYear, b.endYear),
        `${r.id}: coexistence intervals do not overlap`,
      );
  }
}
console.log(
  JSON.stringify(
    {
      eras: eras.length,
      nodes: all.size,
      relations,
      sources,
      uniqueSourceURLs: sourceURLs.size,
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
