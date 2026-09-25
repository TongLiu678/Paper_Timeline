export const FIELD_LABELS = {
  ai: "AI · NLP",
  infra: "AI Infra · 架构",
  eda: "EDA",
  systems: "操作系统 · 系统",
  formal: "形式化 · PL",
  music: "音乐 · 音频",
};

const shanghaiDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shanghaiFull = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function dayParts(date) {
  return Object.fromEntries(
    shanghaiDay.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function shanghaiDateKey(date) {
  const { year, month, day } = dayParts(date);
  return `${year}-${month}-${day}`;
}

export function isUpcoming(deadline, now = new Date()) {
  if (deadline.at) return new Date(deadline.at).getTime() > now.getTime();
  // An AoE date without a stated hour may extend into the next Beijing day.
  // Keep it visible until that day ends, without inventing an exact cutoff.
  const possibleLocalDay = deadline.originalTime?.includes("AoE")
    ? new Date(`${deadline.date}T00:00:00Z`)
    : null;
  if (possibleLocalDay) {
    possibleLocalDay.setUTCDate(possibleLocalDay.getUTCDate() + 1);
    return possibleLocalDay.toISOString().slice(0, 10) >= shanghaiDateKey(now);
  }
  return deadline.date >= shanghaiDateKey(now);
}

export function deadlineSortValue(deadline) {
  return deadline.at
    ? new Date(deadline.at).getTime()
    : new Date(`${deadline.date}T12:00:00Z`).getTime();
}

export function getNextMilestone(conference, now = new Date()) {
  return conference.deadlines
    .filter((deadline) => isUpcoming(deadline, now))
    .sort((a, b) => deadlineSortValue(a) - deadlineSortValue(b))[0] ?? null;
}

export function getStatus(conference, now = new Date()) {
  if (conference.lifecycle === "ended") return "ended";
  return getNextMilestone(conference, now) ? "upcoming" : "pending";
}

export function sortByNextMilestone(conferences, now = new Date()) {
  return [...conferences].sort((a, b) => {
    const nextA = getNextMilestone(a, now);
    const nextB = getNextMilestone(b, now);
    if (!nextA && !nextB) return a.acronym.localeCompare(b.acronym);
    if (!nextA) return 1;
    if (!nextB) return -1;
    return deadlineSortValue(nextA) - deadlineSortValue(nextB)
      || a.acronym.localeCompare(b.acronym);
  });
}

export function filterConferences(conferences, { query = "", field = "all", status = "all" } = {}, now = new Date()) {
  const search = query.trim().toLocaleLowerCase();
  return conferences.filter((conference) => {
    if (field !== "all" && conference.field !== field) return false;
    if (status !== "all" && getStatus(conference, now) !== status) return false;
    if (!search) return true;
    return [conference.acronym, conference.name, conference.nameZh, conference.field, ...(conference.keywords ?? [])]
      .some((value) => value?.toLocaleLowerCase().includes(search));
  });
}

export function formatShanghaiTime(deadline) {
  if (!deadline.at) return `官网日期 ${deadline.date}（具体时刻未公布）`;
  return `${shanghaiFull.format(new Date(deadline.at))} 北京时间`;
}

export function daysUntil(deadline, now = new Date()) {
  const today = shanghaiDateKey(now);
  const target = deadline.at ? shanghaiDateKey(new Date(deadline.at)) : deadline.date;
  const days = (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return Math.round(days);
}

export function getUpcomingMilestones(conferences, now = new Date()) {
  return conferences.flatMap((conference) => conference.deadlines
    .filter((deadline) => isUpcoming(deadline, now))
    .map((deadline) => ({ conference, deadline })))
    .sort((a, b) => deadlineSortValue(a.deadline) - deadlineSortValue(b.deadline));
}

export function monthKey(deadline) {
  const date = deadline.at ? new Date(deadline.at) : new Date(`${deadline.date}T12:00:00Z`);
  return shanghaiDateKey(date).slice(0, 7);
}

function icsEscape(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n")
    .replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function icsUtc(date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

export function toIcs(entries, now = new Date()) {
  const stamp = icsUtc(now);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paper Timeline//Conference Deadlines//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const { conference, deadline } of entries) {
    const title = `截稿：${conference.acronym} ${deadline.edition ?? conference.edition} · ${deadline.label}${deadline.at ? "" : "（官网日期，时刻未公布）"}`;
    lines.push("BEGIN:VEVENT", `UID:${icsEscape(deadline.id)}@paper-timeline.github.io`, `DTSTAMP:${stamp}`);
    if (deadline.at) {
      const start = new Date(deadline.at);
      const end = new Date(start.getTime() + 15 * 60_000);
      lines.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(end)}`);
    } else {
      const date = deadline.date.replaceAll("-", "");
      const next = new Date(`${deadline.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${shanghaiDateKey(next).replaceAll("-", "")}`);
    }
    lines.push(`SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(`${conference.name}\n原时区：${deadline.originalTime}\n官网：${deadline.source}`)}`, `URL:${deadline.source}`);
    if (deadline.at) lines.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(title)}`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
