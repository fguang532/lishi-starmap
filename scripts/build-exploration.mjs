// Only reviewed identities are merged. A shared topic or a partial name is not identity.
const identities = {
  "xia-yu": "ruler-xia-yu",
  "shang-wuding": "ruler-shang-wuding",
  "qin-first-emperor": "ruler-qin-shihuang",
  "western-han-liu-bang": "ruler-han-gao",
  "western-han-emperor-wu": "ruler-han-wu",
  "xin-wang-mang": "ruler-interregnum-wangmang",
  "eastern-han-liu-xiu": "ruler-eastern-han-guangwu",
  "three-kingdoms-cao-pi": "ruler-wei-pi",
  "three-kingdoms-liu-bei": "ruler-shu-bei",
  "three-kingdoms-sun-quan": "ruler-wu-quan",
  "western-jin-sima-yan": "person-sima-yan",
  "eastern-jin-sima-rui": "person-sima-rui",
  "eastern-jin-fu-jian": "person-fu-jian",
  "sui-yang-jian": "person-yang-jian",
  "sui-yang-guang": "person-yang-guang",
  "tang-taizong": "person-li-shimin",
  "tang-wu-zetian": "person-wu-zhao",
  "five-dynasties-qian-liu": "person-qian-liu",
  "five-dynasties-li-yu": "person-li-yu",
  "five-dynasties-chai-rong": "person-chai-rong",
  "yuan-genghis": "person-temujin",
  "yuan-kublai": "person-kublai",
  "ming-hongwu": "person-zhu-yuanzhang",
  "ming-yongle": "person-zhu-di",
  "qing-hong-taiji": "person-hong-taiji",
  "qing-kangxi": "person-xuanye",
  "qing-qianlong": "person-hongli",
  "qing-yongzheng": "person-yinzhen",
  "spring-autumn-chengpu": "battle-chengpu",
  "warring-states-extra-changping": "battle-changping",
  "qin-unification": "battle-qin-unification",
  "xin-kunyang": "battle-kunyang",
  "three-kingdoms-yiling": "battle-yiling",
  "western-jin-conquest-wu": "battle-jin-wu",
  "eastern-jin-feishui": "battle-feishui",
  "sui-unification": "battle-sui-chen",
  "tang-anshi": "battle-anshi",
  "late-qing-opium-war": "battle-opium-first",
  "late-qing-taiping": "battle-taiping",
};
const poetIdentities = {
  "three-kingdoms-cao-pi": "poet-cao-pi",
  "three-kingdoms-extra-cao-zhi": "poet-cao-zhi",
  "eastern-jin-tao-yuanming": "poet-tao-yuanming",
  "northern-southern-xie-lingyun": "poet-xie-lingyun",
  "tang-du-fu": "poet-du-fu",
  "tang-li-bai": "poet-li-bai",
  "five-dynasties-li-yu": "poet-li-yu",
  "song-su-shi": "poet-su-shi",
  "ming-yu-qian": "poet-yu-qian",
  "late-qing-qiu-jin": "poet-qiu-jin",
};
const dualIdentities = [
  ["ruler-wei-cao", "poet-cao-cao"],
  ["ruler-wei-pi", "poet-cao-pi"],
  ["person-li-yu", "poet-li-yu"],
];

export function buildExploration(eras, records, polities) {
  const result = structuredClone(eras);
  const byRecord = new Map(records.map(r => [r.id, r]));
  // `seq` is a reading order for rulers that share one borrowed year because no
  // absolute date is established. It must order across polities as well as
  // inside them, so parallel houses are grouped rather than interleaved: the
  // key is the polity's own position, then the documented order of its terms.
  const polityRank = new Map(
    [...polities]
      .sort((a, b) => a.sortYear - b.sortYear || a.id.localeCompare(b.id))
      .map((p, i) => [p.id, i]),
  );
  const seqOf = (p, i) => polityRank.get(p.id) * 1000 + i;
  const allTerms = polities.flatMap(p => [
    ...p.reigns.map((t, i) => ({ ...t, polity: p, sovereign: true, seq: seqOf(p, i) })),
    ...(p.regencies || []).map((t, i) => ({ ...t, polity: p, sovereign: false, seq: seqOf(p, p.reigns.length + i) })),
  ]);
  const byTerm = new Map(allTerms.map(t => [t.id, t]));
  const nodeFor = new Map();
  for (const [legacy, id] of [...Object.entries(identities), ...Object.entries(poetIdentities)]) {
    if (!byRecord.has(id) || !eras.some(e => e.nodes.some(n => n.id === legacy)))
      throw new Error(`Invalid exploration identity: ${legacy} -> ${id}`);
  }
  for (const era of result) {
    for (const n of era.nodes) {
      if (n.id === "northern-southern-xiaowen") n.tags = n.tags.filter(t => t !== "emperor");
      if (n.id === "warring-states-quyuan") n.tags = n.tags.filter(t => t !== "poet");
    }
    for (const r of [...records].sort((a, b) => (a.kind === "rulers" ? 0 : 1) - (b.kind === "rulers" ? 0 : 1))) {
      // Qin's rebel polities belong to the Qin / Chu-Han transition, not Han's imperial succession.
      const ownTerms = allTerms.filter(t => t.rulerId === r.id);
      const qinTransition = ownTerms.length && ownTerms.every(t => t.polity.id.startsWith("polity-qin-rebel-"));
      if (!r.eraIds.includes(era.id) || (era.id === "western-han" && qinTransition)) continue;
      const peer = dualIdentities.find(pair => pair.includes(r.id))?.find(id => id !== r.id);
      const old = era.nodes.find(n => identities[n.id] === r.id || poetIdentities[n.id] === r.id)
        || (peer && nodeFor.get(`${era.id}:${peer}`));
      const isEmperor = ownTerms.some(t => t.sovereign);
      const tags = r.kind === "battles" ? ["battle", "event"]
        : r.kind === "poets" ? ["poet", "literature"]
        : isEmperor ? ["emperor"] : ["politician"];
      const node = old || {
        id: `academy-${era.id}-${r.id}`,
        title: r.kind !== "battles" && !r.title.includes(r.name) ? `${r.title} · ${r.name}` : r.title,
        type: r.kind === "battles" ? "事件" : "人物",
        dateLabel: r.lifeLabel, startYear: r.sortYear, endYear: r.sortYear,
        certainty: /传说/.test(r.certainty) ? "传说" : /争议|分歧/.test(r.certainty) ? "有争议" : /约|不详|不明/.test(r.certainty) ? "约年" : "史实",
        summary: r.summary, background: r.sections[0].text,
        story: r.sections[1].text, legacy: r.sections[2].text,
        sources: r.sources,
      };
      // A curated node keeps its own startYear: it is a birth year, while sortYear
      // is an accession or polity year, and overwriting it contradicts dateLabel.
      node.tags = [...new Set([...(node.tags || []), ...tags])];
      // Documented succession order, used only to break ties between rulers that
      // share a borrowed sortYear. Absent for battles, poets and curated nodes.
      const seq = ownTerms.length ? Math.min(...ownTerms.map(t => t.seq)) : undefined;
      if (seq !== undefined && node.seq === undefined) node.seq = seq;
      node.archives = [...(node.archives || []), { id: r.id, kind: r.kind, title: r.title }];
      node.affiliations = [...new Set([...(node.affiliations || []), ...ownTerms.map(t => `${t.polity.title}${t.sovereign ? "" : ` · ${t.role}`}`)])];
      node.terms = [...(node.terms || []), ...ownTerms.map(t => ({ title: t.title, polity: t.polity.title, dateLabel: t.dateLabel, note: t.note, sourceUrl: t.sourceUrl }))];
      if (!old) era.nodes.push(node);
      nodeFor.set(`${era.id}:${r.id}`, node);
    }
  }
  // Succession edges keep their source evidence; related reading is not a historical edge.
  for (const era of result) {
    for (const t of allTerms.filter(t => t.sovereign)) {
      const target = nodeFor.get(`${era.id}:${t.rulerId}`);
      if (!target) continue;
      for (const id of t.predecessorIds) {
        const previous = byTerm.get(id);
        const source = previous && nodeFor.get(`${era.id}:${previous.rulerId}`);
        if (source && source.id !== target.id) era.relations.push({
          id: `succession-${era.id}-${id}-${t.id}`, source: source.id, target: target.id,
          type: "继任", explanation: `${t.polity.title}：${t.succession}。${t.note}`, sourceUrl: t.sourceUrl,
        });
      }
    }
    for (const n of era.nodes) {
      const ids = n.archives?.flatMap(a => byRecord.get(a.id).relatedIds || []) || [];
      n.relatedReading = [...new Map([...new Set(ids)].flatMap(id => {
        const other = nodeFor.get(`${era.id}:${id}`) || [...nodeFor].find(([key]) => key.endsWith(`:${id}`))?.[1];
        return other && other.id !== n.id ? [[other.id, { id: other.id, title: other.title }]] : [];
      })).values()];
    }
  }
  return result;
}

// The star map only needs identity, dates, tags and relation endpoints. Prose,
// sources, reign records and relation evidence are read from the era detail file
// when a topic is opened, so the first screen no longer carries every article.
export function splitExploration(eras) {
  const index = eras.map(era => ({
    id: era.id,
    country: era.country,
    title: era.title,
    shortTitle: era.shortTitle,
    englishTitle: era.englishTitle,
    startYear: era.startYear,
    endYear: era.endYear,
    dateLabel: era.dateLabel,
    kicker: era.kicker,
    nodes: era.nodes.map(n => ({
      id: n.id,
      title: n.title,
      type: n.type,
      dateLabel: n.dateLabel,
      startYear: n.startYear,
      endYear: n.endYear,
      certainty: n.certainty,
      summary: n.summary,
      ...(n.tags?.length ? { tags: n.tags } : {}),
      ...(n.seq === undefined ? {} : { seq: n.seq }),
      ...(n.affiliations?.length ? { affiliations: n.affiliations } : {}),
    })),
    relations: era.relations.map(r => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type,
    })),
  }));
  const details = new Map(eras.map(era => [era.id, {
    id: era.id,
    summary: era.summary,
    sources: era.sources,
    nodes: era.nodes.map(n => ({
      id: n.id,
      background: n.background,
      story: n.story,
      legacy: n.legacy,
      sources: n.sources,
      ...(n.archives?.length ? { archives: n.archives } : {}),
      ...(n.terms?.length ? { terms: n.terms } : {}),
      ...(n.relatedReading?.length ? { relatedReading: n.relatedReading } : {}),
    })),
    relations: era.relations.map(r => ({
      id: r.id,
      explanation: r.explanation,
      sourceUrl: r.sourceUrl,
    })),
  }]));
  return { index, details };
}
