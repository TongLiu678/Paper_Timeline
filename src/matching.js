import { deadlineSortValue, getNextMilestone } from "./dates.js?v=2026-09-25-music";
import { conferenceProfiles, topicCatalog } from "./topic-data.js?v=2026-09-25-music";

// A topic may have several aliases in one query, but it should contribute only
// once to a conference's score. Related directions are deliberately weaker.
const PRIMARY_TOPIC_SCORE = 100;
const RELATED_TOPIC_SCORE = 35;
const ACRONYM_SCORE = 180;
const NAME_SCORE = 150;
const KEYWORD_SCORE = 15;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[‐‑‒–—−/+_.,，、;；:：!?！？()[\]{}"'“”‘’|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Chinese queries commonly omit the space in "AI 系统".
    .replace(/(\p{Script=Han})\s+(?=[a-z0-9])/gu, "$1")
    .replace(/([a-z0-9])\s+(?=\p{Script=Han})/gu, "$1");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRanges(query, candidate) {
  const phrase = normalize(candidate);
  if (!phrase) return [];

  const han = phrase.match(/\p{Script=Han}/gu) ?? [];
  const containsAscii = /[a-z0-9]/.test(phrase);
  let pattern;
  // One- or two-character Chinese words (e.g. "系统") are too broad to
  // search inside another Chinese word, but work as standalone query terms.
  if (han.length > 0 && han.length <= 2 && !containsAscii) {
    pattern = `(?:(?<!\\p{Script=Han})|(?<=[和与及]))${escapeRegex(phrase)}(?:(?!\\p{Script=Han})|(?=[和与及]))`;
  } else {
    // ASCII acronyms need token boundaries: AI must not match "training", and
    // ML must not match the first two letters of "MLSys".
    const startsAscii = /^[a-z0-9]/.test(phrase);
    const endsAscii = /[a-z0-9]$/.test(phrase);
    pattern = `${startsAscii ? "(?<![a-z0-9])" : ""}${escapeRegex(phrase).replaceAll(" ", "\\s+")}${endsAscii ? "(?![a-z0-9])" : ""}`;
  }
  return [...query.matchAll(new RegExp(pattern, "gu"))]
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
}

function matchesPhrase(query, candidate) {
  return phraseRanges(query, candidate).length > 0;
}

function matchingTopics(query, catalog) {
  const occurrences = catalog.flatMap((topic) =>
    [topic.label, ...(topic.aliases ?? [])].flatMap((alias) =>
      phraseRanges(query, alias).map((range) => ({ topicId: topic.id, ...range }))));
  // "大模型推理" should mean the specific direction, not also the shorter
  // "大模型" whose occurrence lies wholly inside it. Separate terms retain
  // separate spans and can still contribute together.
  const specificOccurrences = occurrences.filter((item) => !occurrences.some((other) =>
    other.start <= item.start && other.end >= item.end
      && other.end - other.start > item.end - item.start));
  const matchedIds = new Set(specificOccurrences.map((item) => item.topicId));
  return catalog.filter((topic) => matchedIds.has(topic.id));
}

function nextOfficialMilestone(conference, now) {
  if (conference.lifecycle === "ended" || !Array.isArray(conference.deadlines)) return null;
  const next = getNextMilestone(conference, now);
  return next?.source ? next : null;
}

/**
 * Find conferences for a free-text research direction. The optional fourth
 * argument makes the catalog injectable for tests; callers normally use the
 * shared, source-backed topic catalog.
 */
export function matchConferences(
  conferences,
  query,
  now = new Date(),
  data = { topicCatalog, conferenceProfiles },
) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const { topicCatalog: catalog = [], conferenceProfiles: profiles = {} } = data;
  const topics = matchingTopics(normalizedQuery, catalog);
  const results = [];

  for (const conference of conferences) {
    const profile = profiles[conference.id] ?? null;
    const primaryIds = new Set(profile?.topicIds ?? []);
    const relatedIds = new Set(profile?.relatedTopicIds ?? []);
    const matchedTopics = [];
    const reasons = [];
    let score = 0;

    for (const topic of topics) {
      if (primaryIds.has(topic.id)) {
        matchedTopics.push({ id: topic.id, label: topic.label, relation: "primary" });
        reasons.push(`匹配主题：${topic.label}`);
        score += PRIMARY_TOPIC_SCORE;
      } else if (relatedIds.has(topic.id)) {
        matchedTopics.push({ id: topic.id, label: topic.label, relation: "related" });
        reasons.push(`相关方向：${topic.label}`);
        score += RELATED_TOPIC_SCORE;
      }
    }

    if (matchesPhrase(normalizedQuery, conference.acronym)) {
      reasons.push(`会议名称：${conference.acronym}`);
      score += ACRONYM_SCORE;
    } else if ([conference.name, conference.nameZh].some((name) => matchesPhrase(normalizedQuery, name))) {
      reasons.push(`会议名称：${conference.acronym}`);
      score += NAME_SCORE;
    }

    // Explicit conference keywords fill gaps only when the *query* contains
    // no catalog topic; otherwise a broad keyword can undo specific matching.
    if (topics.length === 0) {
      const keyword = (conference.keywords ?? []).find((item) => matchesPhrase(normalizedQuery, item));
      if (keyword) {
        reasons.push(`会议关键词：${keyword}`);
        score += KEYWORD_SCORE;
      }
    }

    if (score > 0) results.push({ conference, profile, matchedTopics, score, reasons });
  }

  return results.sort((a, b) => {
    // Archived series can be discovered, but should never outrank venues that
    // may accept a future submission.
    if (a.conference.lifecycle === "ended" && b.conference.lifecycle !== "ended") return 1;
    if (b.conference.lifecycle === "ended" && a.conference.lifecycle !== "ended") return -1;
    if (a.score !== b.score) return b.score - a.score;
    const nextA = nextOfficialMilestone(a.conference, now);
    const nextB = nextOfficialMilestone(b.conference, now);
    if (nextA && !nextB) return -1;
    if (!nextA && nextB) return 1;
    if (nextA && nextB) {
      const dateOrder = deadlineSortValue(nextA) - deadlineSortValue(nextB);
      if (dateOrder) return dateOrder;
    }
    return a.conference.acronym.localeCompare(b.conference.acronym, "en")
      || a.conference.id.localeCompare(b.conference.id, "en");
  });
}
