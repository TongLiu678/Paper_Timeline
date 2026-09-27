import test from "node:test";
import assert from "node:assert/strict";
import { conferences } from "../src/conferences.js";
import { filterConferences, getNextMilestone } from "../src/dates.js";
import { matchConferences } from "../src/matching.js";

const now = new Date("2026-09-27T00:00:00Z");

test("NLP filter includes core and specialist venues independently of AI", () => {
  const ids = new Set(filterConferences(conferences, { field: "nlp" }, now).map((item) => item.id));
  for (const id of ["acl", "emnlp", "naacl", "coling", "eacl", "colm", "aacl", "conll", "lrec", "inlg", "sigdial", "paclic", "alta", "wmt", "semeval", "starsem"]) {
    assert.ok(ids.has(id), `${id} should appear in NLP`);
  }
  assert.equal(ids.size, 16);
  assert.equal(ids.has("neurips"), false);
});

test("specific NLP queries surface specialist conferences and keep historical dates out of the countdown", () => {
  const idsFor = (query) => new Set(matchConferences(conferences, query, now).map(({ conference }) => conference.id));
  assert.ok(idsFor("自然语言生成").has("inlg"));
  assert.ok(idsFor("对话系统").has("sigdial"));
  assert.ok(idsFor("语言资源与评测").has("lrec"));
  assert.ok(idsFor("机器翻译").has("aacl"));
  assert.ok(idsFor("机器翻译").has("wmt"));
  assert.ok(idsFor("语义评测").has("semeval"));
  assert.equal(getNextMilestone(conferences.find((item) => item.id === "lrec"), now), null);
  assert.equal(getNextMilestone(conferences.find((item) => item.id === "semeval"), now), null);
  assert.equal(getNextMilestone(conferences.find((item) => item.id === "alta"), now)?.id, "alta-2026-nonarchival");
});
