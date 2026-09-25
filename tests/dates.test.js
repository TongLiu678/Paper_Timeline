import test from "node:test";
import assert from "node:assert/strict";
import {
  daysUntil, filterConferences, formatShanghaiTime, getNextMilestone,
  getStatus, isUpcoming, monthKey, sortByNextMilestone, toIcs,
} from "../src/dates.js";

const now = new Date("2026-09-25T00:00:00Z");
const aoe = { id: "cpp-aoe", label: "论文全文", date: "2026-10-20", at: "2026-10-20T23:59:00-12:00", originalTime: "2026-10-20 23:59 AoE", source: "https://example.org/cfp" };
const past = { id: "past", label: "摘要", date: "2026-09-01", at: "2026-09-01T23:59:00-12:00", originalTime: "2026-09-01 23:59 AoE", source: "https://example.org/cfp" };
const cpp = { id: "cpp", acronym: "CPP", edition: 2027, name: "Certified Programs and Proofs", nameZh: "认证程序与证明", field: "formal", deadlines: [past, aoe] };
const mlsys = { id: "mlsys", acronym: "MLSys", edition: 2027, name: "Machine Learning and Systems", nameZh: "机器学习系统", field: "infra", deadlines: [{ id: "mlsys-paper", label: "论文全文", date: "2026-10-30", at: "2026-10-30T20:00:00Z", originalTime: "2026-10-30 20:00 UTC", source: "https://example.org/mlsys" }] };

test("AoE time converts to the following Beijing calendar day", () => {
  assert.match(formatShanghaiTime(aoe), /10月21日 19:59/);
  assert.equal(monthKey(aoe), "2026-10");
  assert.equal(daysUntil(aoe, now), 26);
});

test("next milestone ignores a past abstract deadline", () => {
  assert.equal(getNextMilestone(cpp, now)?.id, "cpp-aoe");
  assert.equal(getStatus({ ...cpp, deadlines: [past] }, now), "pending");
  assert.equal(isUpcoming(past, now), false);
  assert.equal(getStatus({ ...cpp, lifecycle: "ended" }, now), "ended");
});

test("date-only AoE stays visible through the following Beijing day without an exact time", () => {
  const dateOnly = { id: "date-only", label: "特别轨论文", date: "2026-10-18", originalTime: "2026-10-18 AoE（官网未注明时刻）", source: "https://example.org/cfp" };
  assert.equal(isUpcoming(dateOnly, new Date("2026-10-19T04:00:00Z")), true);
  assert.equal(isUpcoming(dateOnly, new Date("2026-10-19T16:00:00Z")), false);
  assert.match(formatShanghaiTime(dateOnly), /官网日期.*具体时刻未公布/);
  assert.match(toIcs([{ conference: cpp, deadline: dateOnly }], now), /DTSTART;VALUE=DATE:20261018/);
});

test("Chinese search and chronological ordering work across fields", () => {
  assert.deepEqual(filterConferences([cpp, mlsys], { query: "证明" }, now).map((item) => item.id), ["cpp"]);
  assert.deepEqual(filterConferences([cpp, mlsys], { field: "infra" }, now).map((item) => item.id), ["mlsys"]);
  assert.deepEqual(sortByNextMilestone([mlsys, cpp], now).map((item) => item.id), ["cpp", "mlsys"]);
});

test("ICS preserves the exact instant and escapes title text", () => {
  const output = toIcs([{ conference: { ...cpp, acronym: "CPP, Core" }, deadline: aoe }], now);
  assert.match(output, /DTSTART:20261021T115900Z/);
  assert.match(output, /SUMMARY:截稿：CPP\\, Core 2027 · 论文全文/);
  assert.match(output, /TRIGGER:-P1D/);
});
