import test from "node:test";
import assert from "node:assert/strict";
import { conferences } from "../src/conferences.js";
import { getNextMilestone, getStatus } from "../src/dates.js";
import { matchConferences } from "../src/matching.js";

const now = new Date("2026-10-12T00:00:00Z");
const byId = new Map(conferences.map((conference) => [conference.id, conference]));

test("DSL aliases find core venues and distinguish related PL venues", () => {
  for (const query of ["DSL", "领域特定语言", "domain-specific language", "领域专用建模"]) {
    const matches = matchConferences(conferences, query, now);
    const relation = new Map(matches.map(({ conference, matchedTopics }) => [
      conference.id,
      matchedTopics.find((topic) => topic.id === "dsl")?.relation,
    ]));
    for (const id of ["sle", "gpce", "models"]) assert.equal(relation.get(id), "primary", `${query}: ${id}`);
    for (const id of ["oopsla", "ecoop", "pldi", "pepm", "icfp", "icse", "ase", "fse"]) assert.equal(relation.get(id), "related", `${query}: ${id}`);
  }
  assert.equal(matchConferences(conferences, "ADSL", now).length, 0);
});

test("past DSL CFPs remain historical and published next rounds stay visible", () => {
  for (const id of ["sle", "gpce", "models"]) {
    assert.equal(getStatus(byId.get(id), now), "pending", id);
    assert.equal(getNextMilestone(byId.get(id), now), null, id);
  }
  assert.equal(getNextMilestone(byId.get("oopsla"), now)?.date, "2026-10-14");
  assert.equal(getNextMilestone(byId.get("pepm"), now)?.date, "2026-10-23");
  assert.equal(getNextMilestone(byId.get("pldi"), now)?.date, "2026-11-12");
  assert.equal(byId.get("pldi").deadlines[0].at, undefined);
  assert.equal(getNextMilestone(byId.get("ecoop"), now)?.date, "2026-11-19");
  assert.equal(byId.get("ecoop").deadlines[0].at, undefined);
  assert.equal(getNextMilestone(byId.get("icfp"), now)?.date, "2027-02-25");
  for (const id of ["icse", "ase", "fse"]) assert.equal(getNextMilestone(byId.get(id), now), null);
  assert.equal(byId.get("fse").deadlines[0].date, "2026-10-03");
});
