import fs from "node:fs";
const file = process.argv[2];
if (!file) throw new Error("Provide a history JSON path");
const eras = JSON.parse(fs.readFileSync(file, "utf8"));
const errors = [];
const ids = new Set();
const all = new Map();
const sourceURLs = new Set();
const allowedTags = new Set([
  "emperor",
  "minister",
  "politician",
  "poet",
  "thinker",
  "artist",
  "event",
  "battle",
  "literature",
  "painting",
  "artifact",
  "institution",
  "society",
  "archaeology",
]);
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
  ok(e.nodes.length >= 10, `${e.id}: requires 10 nodes`);
  sourcesCheck(e.sources, e.id);
  for (const n of e.nodes) {
    ok(!ids.has(n.id), `Duplicate ID ${n.id}`);
    ids.add(n.id);
    all.set(n.id, n);
    ok(
      Array.isArray(n.tags) &&
        n.tags.length > 0 &&
        n.tags.every((t) => allowedTags.has(t)),
      `${n.id}: invalid interest tags`,
    );
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
const images = JSON.parse(
  fs.readFileSync(new URL("../data/images.json", import.meta.url), "utf8"),
);
const anecdotes = JSON.parse(
  fs.readFileSync(new URL("../data/anecdotes.json", import.meta.url), "utf8"),
);
const extraIds = new Set();
for (const im of images) {
  ok(!extraIds.has(im.id), `Duplicate image ${im.id}`);
  extraIds.add(im.id);
  ok(
    im.eraIds.length > 0 &&
      im.eraIds.every((id) => eras.some((e) => e.id === id)),
    `${im.id}: invalid era references`,
  );
  ok(
    im.nodeIds.every((id) => all.has(id)),
    `${im.id}: invalid node references`,
  );
  ok(
    !!im.title &&
      !!im.dating &&
      !!im.caption &&
      !!im.alt &&
      !!im.credit &&
      !!im.license,
    `${im.id}: missing image attribution`,
  );
  ok(
    im.localSrc.startsWith("/history/") &&
      fs.existsSync(new URL(`../public${im.localSrc}`, import.meta.url)),
    `${im.id}: missing local image`,
  );
  sourcesCheck(
    [{ title: im.title, institution: im.institution, url: im.sourceUrl }],
    im.id,
  );
}
for (const a of anecdotes) {
  ok(!extraIds.has(a.id), `Duplicate anecdote ${a.id}`);
  extraIds.add(a.id);
  const era = eras.find((e) => e.id === a.eraId);
  ok(
    !!era &&
      a.nodeIds.length > 0 &&
      a.nodeIds.every((id) => era.nodes.some((n) => n.id === id)),
    `${a.id}: invalid anecdote references`,
  );
  ok(
    !!a.title && cjk(a.text) >= 65 && !!a.evidenceLabel,
    `${a.id}: incomplete anecdote`,
  );
  sourcesCheck([a.source], a.id);
}
for (const e of eras) {
  ok(
    images.some((im) => im.eraIds.includes(e.id)),
    `${e.id}: requires a historical image`,
  );
  ok(
    anecdotes.some((a) => a.eraId === e.id),
    `${e.id}: requires a sourced anecdote`,
  );
}
console.log(
  JSON.stringify(
    {
      eras: eras.length,
      nodes: all.size,
      relations,
      images: images.length,
      anecdotes: anecdotes.length,
      sources,
      uniqueSourceURLs: sourceURLs.size,
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
