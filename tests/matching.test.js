import test from "node:test";
import assert from "node:assert/strict";
import { matchConferences } from "../src/matching.js";
import { conferences as publishedConferences } from "../src/conferences.js";

const now = new Date("2026-09-25T00:00:00Z");
const topicCatalog = [
  { id: "nlp", label: "自然语言处理", aliases: ["NLP", "computational linguistics"] },
  { id: "ml", label: "机器学习", aliases: ["ML", "machine learning"] },
  { id: "formal", label: "形式化方法", aliases: ["形式化验证", "formal methods", "PL"] },
  { id: "ai", label: "人工智能", aliases: ["AI"] },
  { id: "systems", label: "系统", aliases: [] },
  { id: "llm", label: "大语言模型", aliases: ["大模型", "LLM"] },
  { id: "ml-systems", label: "AI 系统与模型推理", aliases: ["大模型推理", "机器学习系统", "推理系统"] },
  { id: "eda", label: "电子设计自动化", aliases: ["EDA"] },
  { id: "ai-eda", label: "AI 辅助 EDA", aliases: ["AI for EDA"] },
];

function deadline(id, date) {
  return { id, date, at: `${date}T23:59:00Z`, source: "https://example.org/cfp" };
}

function conference(id, acronym, extra = {}) {
  return {
    id,
    acronym,
    name: `${acronym} Research Conference`,
    nameZh: `${acronym} 研究会议`,
    keywords: [],
    deadlines: [],
    ...extra,
  };
}

const acl = conference("acl", "ACL", { nameZh: "计算语言学协会年会", deadlines: [deadline("acl-paper", "2026-11-01")] });
const mlsys = conference("mlsys", "MLSys", { deadlines: [deadline("mlsys-paper", "2026-10-10")] });
const pldi = conference("pldi", "PLDI", { nameZh: "程序语言设计与实现会议", deadlines: [deadline("pldi-paper", "2026-12-01")] });
const icml = conference("icml", "ICML", { deadlines: [deadline("icml-paper", "2026-10-20")] });
const conferences = [acl, mlsys, pldi, icml];
const data = {
  topicCatalog,
  conferenceProfiles: {
    acl: { summary: "自然语言处理主会", topicIds: ["nlp"], relatedTopicIds: ["ml"] },
    mlsys: { summary: "机器学习系统主会", topicIds: ["ml"], relatedTopicIds: ["ai"] },
    pldi: { summary: "程序语言主会", topicIds: ["formal"], relatedTopicIds: ["ml"] },
    icml: { summary: "机器学习主会", topicIds: ["ml"], relatedTopicIds: ["ai"] },
  },
};

const find = (query, items = conferences, customData = data) => matchConferences(items, query, now, customData);

test("Chinese labels and English aliases match the same explicit topic once", () => {
  for (const query of ["自然语言处理", "NLP", "computational linguistics", "NLP 自然语言处理"]) {
    const result = find(query);
    assert.equal(result[0].conference.id, "acl");
    assert.deepEqual(result[0].matchedTopics, [{ id: "nlp", label: "自然语言处理", relation: "primary" }]);
    assert.equal(result[0].score, 100);
    assert.deepEqual(result[0].reasons, ["匹配主题：自然语言处理"]);
  }
});

test("primary topic outranks a related direction, while cross-field matches remain visible", () => {
  const result = find("机器学习");
  assert.deepEqual(result.map((item) => item.conference.id), ["mlsys", "icml", "acl", "pldi"]);
  assert.deepEqual(result.map((item) => item.score), [100, 100, 35, 35]);
  assert.deepEqual(result[2].reasons, ["相关方向：机器学习"]);

  const combined = find("机器学习 形式化验证");
  assert.equal(combined[0].conference.id, "pldi");
  assert.deepEqual(combined[0].matchedTopics.map((topic) => topic.relation), ["related", "primary"]);
  assert.equal(combined[0].score, 135);
});

test("short Latin aliases require token boundaries, and short Chinese terms do not match inside longer words", () => {
  assert.deepEqual(find("training"), []); // "ai" occurs inside an unrelated word.
  assert.deepEqual(find("replanning"), []); // "pl" occurs inside an unrelated word.
  assert.deepEqual(find("MLSys").map((item) => item.conference.id), ["mlsys"]);
  assert.deepEqual(find("操作系统", [conference("os", "OS")], {
    topicCatalog,
    conferenceProfiles: { os: { topicIds: ["systems"] } },
  }), []);
  assert.equal(find("系统", [conference("os", "OS")], {
    topicCatalog,
    conferenceProfiles: { os: { topicIds: ["systems"] } },
  })[0].conference.id, "os");
});

test("a longer alias suppresses shorter topics within the same span", () => {
  const items = [
    conference("llm-venue", "LLMV"),
    conference("ml-venue", "MLV"),
    conference("systems-venue", "SYSV"),
    conference("ai-venue", "AIV", { keywords: ["AI for EDA"] }),
    conference("eda-venue", "EDAV"),
    conference("ai-eda-venue", "AIEDAV"),
  ];
  const scopedData = {
    topicCatalog,
    conferenceProfiles: {
      "llm-venue": { topicIds: ["llm"] },
      "ml-venue": { topicIds: ["ml"] },
      "systems-venue": { topicIds: ["ml-systems"] },
      "ai-venue": { topicIds: ["ai"] },
      "eda-venue": { topicIds: ["eda"] },
      "ai-eda-venue": { topicIds: ["ai-eda"] },
    },
  };
  assert.deepEqual(find("大模型推理", items, scopedData).map((item) => item.conference.id), ["systems-venue"]);
  assert.deepEqual(find("机器学习系统", items, scopedData).map((item) => item.conference.id), ["systems-venue"]);
  assert.deepEqual(find("AI for EDA", items, scopedData).map((item) => item.conference.id), ["ai-eda-venue"]);
  assert.deepEqual(find("LLM 推理系统", items, scopedData).map((item) => item.conference.id).sort(), ["llm-venue", "systems-venue"]);
});

test("conference acronym and Chinese name are direct, explainable matches", () => {
  assert.deepEqual(find("PLDI").map((item) => item.reasons), [["会议名称：PLDI"]]);
  assert.deepEqual(find("计算语言学协会年会").map((item) => item.reasons), [["会议名称：ACL"]]);
});

test("ties prefer upcoming official deadlines, then earlier dates, then acronym", () => {
  const tied = [
    conference("z", "ZZZ", { deadlines: [deadline("z-paper", "2026-10-01")] }),
    conference("a", "AAA", { deadlines: [deadline("a-paper", "2026-11-01")] }),
    conference("b", "BBB", { deadlines: [deadline("b-paper", "2026-11-01")] }),
    conference("p", "PPP"),
    conference("e", "EEE", { lifecycle: "ended", deadlines: [deadline("e-paper", "2026-09-30")] }),
  ];
  const tiedData = {
    topicCatalog,
    conferenceProfiles: Object.fromEntries(tied.map((item) => [item.id, { topicIds: ["ml"] }])),
  };
  assert.deepEqual(find("ML", tied, tiedData).map((item) => item.conference.id), ["z", "a", "b", "p", "e"]);
});

test("unknown or blank queries return no guesses", () => {
  assert.deepEqual(find("量子纠错"), []);
  assert.deepEqual(find("   "), []);
});

test("published profiles keep specific queries useful across broad fields", () => {
  const lookup = (query) => matchConferences(publishedConferences, query, now);
  assert.equal(lookup("大模型推理")[0].conference.id, "mlsys");
  assert.deepEqual(lookup("AI for EDA").map(({ conference }) => conference.id).sort(), ["aspdac", "dac", "date", "iccad"]);
  const formal = lookup("形式化验证").map(({ conference }) => conference.id);
  assert.ok(formal.includes("cav") && formal.includes("iccad"));
  assert.equal(lookup("CPP")[0].conference.id, "cpp");
  assert.equal(lookup("系统").at(-1).conference.id, "usenix-atc");
});
