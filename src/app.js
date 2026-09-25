import { conferences, verifiedOn } from "./conferences.js";
import {
  FIELD_LABELS, daysUntil, deadlineSortValue, filterConferences, formatShanghaiTime,
  getNextMilestone, getStatus, getUpcomingMilestones, isUpcoming,
  monthKey, shanghaiDateKey, sortByNextMilestone, toIcs,
} from "./dates.js";
import { matchConferences } from "./matching.js";

const $ = (selector) => document.querySelector(selector);
const state = { topic: "", query: "", field: "all", status: "all", view: "timeline", month: shanghaiDateKey(new Date()).slice(0, 7) };
const fieldOrder = ["all", ...Object.keys(FIELD_LABELS)];
const statusLabels = { all: "全部会议", upcoming: "即将截止", pending: "待公布", ended: "已结束" };

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function localDate(deadline) {
  return deadline.at ? shanghaiDateKey(new Date(deadline.at)) : deadline.date;
}

function niceDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function monthTitle(key) {
  const [year, month] = key.split("-").map(Number);
  return `${year}年${month}月`;
}

function countdown(deadline) {
  const days = daysUntil(deadline);
  if (!deadline.at) {
    if (days < 0) return "官网日期已过 · 时刻待核对";
    if (days === 0) return "官网日期为今天";
    return `官网日期还有约 ${days} 天`;
  }
  if (days < 0) return "已截止";
  if (days === 0) return "今天截止";
  if (days === 1) return "明天截止";
  return `还有 ${days} 天`;
}

function kindClass(kind) {
  return ["paper", "abstract", "commit", "registration", "artifact", "supplement"].includes(kind) ? kind : "other";
}

function fieldBadge(conference) {
  return `<span class="field-badge field-${escapeHtml(conference.field)}">${escapeHtml(FIELD_LABELS[conference.field])}</span>`;
}

function renderHero(items) {
  $("#hero-context").textContent = state.topic.trim() ? "匹配方向的最近投稿节点" : state.query || state.field !== "all" || state.status !== "all" ? "当前筛选的最近投稿节点" : "距离最近的官方截稿";
  const next = getUpcomingMilestones(items)[0];
  const target = $("#hero-next");
  if (!next) {
    target.innerHTML = `<div class="next-empty">当前结果没有已公布的未来截稿节点</div>`;
    return;
  }
  const { conference, deadline } = next;
  target.innerHTML = `<div class="next-count">${escapeHtml(countdown(deadline))}</div>
    <div class="next-conference">${escapeHtml(conference.acronym)} <span>${escapeHtml(conference.edition)}</span></div>
    <div class="next-date">${escapeHtml(deadline.label)} · ${escapeHtml(niceDate(localDate(deadline)))}${deadline.at ? "（北京）" : "（官网日期）"}</div>
    ${conference.alert ? `<div class="next-alert">${escapeHtml(conference.alert)}</div>` : ""}
    <a href="${escapeHtml(deadline.source)}" target="_blank" rel="noopener noreferrer" class="next-source">查看官方征稿 <span aria-hidden="true">↗</span></a>`;
}

function renderStats() {
  const upcoming = conferences.filter((item) => getStatus(item) === "upcoming").length;
  const pending = conferences.filter((item) => getStatus(item) === "pending").length;
  $("#stats").innerHTML = `<div><strong>${conferences.length}</strong><span>关注会议</span></div><div><strong>${upcoming}</strong><span>仍有官方节点</span></div><div><strong>${pending}</strong><span>下轮待公布</span></div>`;
}

function renderFilters() {
  $("#field-filters").innerHTML = fieldOrder.map((field) => {
    const label = field === "all" ? "全部领域" : FIELD_LABELS[field];
    return `<button type="button" data-field="${field}" class="filter-chip ${state.field === field ? "is-active" : ""}" aria-pressed="${state.field === field}">${escapeHtml(label)}</button>`;
  }).join("");
  $("#status-filters").innerHTML = Object.entries(statusLabels).map(([status, label]) =>
    `<button type="button" data-status="${status}" class="status-chip ${state.status === status ? "is-active" : ""}" aria-pressed="${state.status === status}">${escapeHtml(label)}</button>`,
  ).join("");
}

function renderMilestoneRow(deadline, conference) {
  const passed = !isUpcoming(deadline);
  const edition = deadline.edition ?? conference.edition;
  return `<li class="milestone-row ${passed ? "is-past" : ""}">
    <span class="milestone-node" aria-hidden="true"></span>
    <div class="milestone-main"><span class="milestone-title">${escapeHtml(deadline.label)}${edition !== conference.edition ? ` <small>· ${edition} 届</small>` : ""}</span><span class="milestone-original">${escapeHtml(deadline.originalTime)}</span></div>
    <div class="milestone-right"><span>${escapeHtml(formatShanghaiTime(deadline))}</span><a href="${escapeHtml(deadline.source)}" target="_blank" rel="noopener noreferrer" aria-label="查看 ${escapeHtml(conference.acronym)} ${escapeHtml(deadline.label)} 的官方来源">官网 ↗</a></div>
  </li>`;
}

function renderUpcomingCard(conference) {
  const next = getNextMilestone(conference);
  if (!next) return "";
  const [year, month, day] = localDate(next).split("-");
  const sorted = [...conference.deadlines].sort((a, b) => new Date(a.at ?? `${a.date}T12:00:00Z`) - new Date(b.at ?? `${b.date}T12:00:00Z`));
  return `<article class="deadline-card field-border-${escapeHtml(conference.field)}" id="conf-${escapeHtml(conference.id)}">
    <div class="card-date"><span class="card-day">${Number(day)}</span><span class="card-month">${Number(month)}月 · ${year}</span></div>
    <div class="card-main"><div class="card-topline">${fieldBadge(conference)}<span class="card-divider"></span><span class="card-phase phase-${kindClass(next.kind)}">${escapeHtml(next.label)}</span></div>
      <h3>${escapeHtml(conference.acronym)} <span>${escapeHtml(conference.edition)}</span></h3><p class="card-fullname">${escapeHtml(conference.nameZh || conference.name)}</p>
      <div class="card-times"><span class="time-strong">${escapeHtml(formatShanghaiTime(next))}</span><span>官网原时区：${escapeHtml(next.originalTime)}</span></div>${conference.alert ? `<p class="card-alert"><span aria-hidden="true">!</span>${escapeHtml(conference.alert)}</p>` : ""}
      <details class="deadline-details"><summary>查看全部投稿节点 <span aria-hidden="true">＋</span></summary><ol class="milestone-list">${sorted.map((item) => renderMilestoneRow(item, conference)).join("")}</ol>${conference.note ? `<p class="conference-note">${escapeHtml(conference.note)}</p>` : ""}</details>
    </div>
    <div class="card-action"><span class="countdown ${daysUntil(next) <= 7 ? "is-urgent" : ""}"><span class="countdown-dot" aria-hidden="true"></span>${escapeHtml(countdown(next))}</span><a href="${escapeHtml(next.source)}" target="_blank" rel="noopener noreferrer" class="source-link">官方 CFP <span aria-hidden="true">↗</span></a><button type="button" class="single-export" data-export="${escapeHtml(conference.id)}" aria-label="导出 ${escapeHtml(conference.acronym)} 的未来截稿节点">加入日历 <span aria-hidden="true">↗</span></button></div>
  </article>`;
}

function renderPendingCard(conference, ended = false) {
  const last = [...conference.deadlines].sort((a, b) =>
    deadlineSortValue(b) - deadlineSortValue(a) || Number(b.kind === "paper") - Number(a.kind === "paper"))[0];
  const lastLabel = last ? `最近官方记录：${last.edition ?? conference.edition} 届 · ${last.label} ${niceDate(last.date)}` : "官网尚未公布论文投稿日期";
  return `<article class="pending-card" id="conf-${escapeHtml(conference.id)}"><div class="pending-symbol" aria-hidden="true">${ended ? "—" : "?"}</div><div class="pending-body"><div class="pending-top">${fieldBadge(conference)}<span class="pending-tag">${ended ? "已结束举办" : "下一轮待公布"}</span></div><h3>${escapeHtml(conference.acronym)} <span>${escapeHtml(conference.edition)}</span></h3><p>${escapeHtml(conference.nameZh || conference.name)}</p><small>${escapeHtml(lastLabel)}</small>${conference.note ? `<p class="pending-note">${escapeHtml(conference.note)}</p>` : ""}</div><a href="${escapeHtml(conference.cfp)}" target="_blank" rel="noopener noreferrer" class="pending-link">${ended ? "主办方说明" : "查看官网"} <span aria-hidden="true">↗</span></a></article>`;
}

function renderMatchCard(match, index) {
  const { conference, profile, reasons } = match;
  const status = getStatus(conference);
  const next = getNextMilestone(conference);
  const sorted = [...conference.deadlines].sort((a, b) => new Date(a.at ?? `${a.date}T12:00:00Z`) - new Date(b.at ?? `${b.date}T12:00:00Z`));
  const statusLabel = status === "upcoming" ? "有已公布节点" : status === "ended" ? "已结束举办" : "下一轮待公布";
  const nextLabel = next ? `${next.label} · ${formatShanghaiTime(next)}` : status === "ended" ? "该系列已结束举办" : "下一轮投稿日期待官网公布";
  const nextDetail = next ? `官网原时区：${next.originalTime}` : "往届日期仅作历史参考，不据此推算下一轮。";
  return `<article class="match-card field-border-${escapeHtml(conference.field)}" id="conf-${escapeHtml(conference.id)}">
    <div class="match-card-top"><span class="match-rank">#${String(index + 1).padStart(2, "0")}</span>${fieldBadge(conference)}<span class="match-status ${status === "upcoming" ? "" : `is-${status}`}">${statusLabel}</span></div>
    <h4>${escapeHtml(conference.acronym)} <span>${escapeHtml(conference.edition)}</span></h4>
    <p class="match-name">${escapeHtml(conference.nameZh || conference.name)}</p>
    <p class="match-summary">${escapeHtml(profile.summary)}</p>
    <div class="match-reasons"><span>匹配依据</span>${reasons.map((reason) => `<em>${escapeHtml(reason)}</em>`).join("")}</div>
    <div class="match-next"><strong>${escapeHtml(nextLabel)}</strong><span>${escapeHtml(nextDetail)}</span></div>
    ${conference.alert ? `<p class="card-alert"><span aria-hidden="true">!</span>${escapeHtml(conference.alert)}</p>` : ""}
    <details class="deadline-details"><summary>查看全部投稿节点与说明 <span aria-hidden="true">＋</span></summary>${sorted.length ? `<ol class="milestone-list">${sorted.map((item) => renderMilestoneRow(item, conference)).join("")}</ol>` : `<p class="conference-note">官网尚未公布投稿节点。</p>`}${conference.note ? `<p class="conference-note">${escapeHtml(conference.note)}</p>` : ""}</details>
    <div class="match-card-footer"><a href="${escapeHtml(conference.cfp)}" target="_blank" rel="noopener noreferrer">查看官方页面 <span aria-hidden="true">↗</span></a><span>范围与日期以官网为准</span></div>
  </article>`;
}

function renderMatchTimeline(matches, totalMatches) {
  if (!matches.length) {
    const filteredOut = totalMatches > 0;
    $("#timeline-view").innerHTML = `<div class="empty-state"><span>⌕</span><h3>${filteredOut ? "当前其他筛选条件没有命中" : "暂未找到这个方向的会议"}</h3><p>${filteredOut ? "这个方向有相关会议，可清除领域、状态或会议名称筛选。" : "试试更具体或常见的研究词，例如“大模型推理”“EDA”“形式化验证”。"}</p>${filteredOut ? `<button type="button" data-clear-filters>清除其他筛选</button>` : ""}</div>`;
    return;
  }
  $("#timeline-view").innerHTML = `<section aria-label="研究方向匹配结果"><div class="match-intro"><div><p class="section-kicker">MATCHED CONFERENCES</p><h3>已收录会议中与“${escapeHtml(state.topic.trim())}”相关的结果</h3></div><p>按主题相关度排列；同等相关时优先显示较近的已公布节点。</p></div><div class="match-grid">${matches.map(renderMatchCard).join("")}</div></section>`;
}

function renderTimeline(items) {
  const upcoming = sortByNextMilestone(items.filter((item) => getStatus(item) === "upcoming"));
  const pending = items.filter((item) => getStatus(item) === "pending").sort((a, b) => a.acronym.localeCompare(b.acronym));
  const ended = items.filter((item) => getStatus(item) === "ended");
  const sections = [];
  if (upcoming.length) {
    const grouped = groupBy(upcoming, (item) => monthKey(getNextMilestone(item)));
    for (const [month, group] of grouped) {
      sections.push(`<section class="month-section" aria-label="${escapeHtml(monthTitle(month))}"><div class="month-heading"><span class="month-index">${month.split("-")[1]}</span><h3>${escapeHtml(monthTitle(month))}</h3><span class="month-count">${group.length} 场会议</span><span class="month-rule"></span></div><div class="cards">${group.map(renderUpcomingCard).join("")}</div></section>`);
    }
  }
  if (pending.length) sections.push(`<section class="quiet-section"><div class="quiet-heading"><span class="quiet-icon">⋯</span><div><p class="section-kicker">WAITING FOR CFP</p><h3>下一轮待公布</h3></div><span>${pending.length} 场会议</span></div><p class="quiet-description">这里保留最近一次官方记录作参考；新一届截稿日期公布前，不显示推测倒计时。</p><div class="pending-grid">${pending.map((item) => renderPendingCard(item)).join("")}</div></section>`);
  if (ended.length) sections.push(`<section class="quiet-section ended-section"><div class="quiet-heading"><span class="quiet-icon">—</span><div><p class="section-kicker">ARCHIVE</p><h3>已结束的会议系列</h3></div></div><div class="pending-grid">${ended.map((item) => renderPendingCard(item, true)).join("")}</div></section>`);
  $("#timeline-view").innerHTML = sections.join("") || `<div class="empty-state"><span>⌕</span><h3>没有找到符合条件的会议</h3><p>试试其他关键词或筛选条件。</p></div>`;
}

function changeMonth(offset) {
  const [year, month] = state.month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  state.month = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
  render();
}

function renderCalendar(items) {
  const [year, month] = state.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const events = items.flatMap((conference) => conference.deadlines.map((deadline) => ({ conference, deadline })));
  const byDay = groupBy(events.filter(({ deadline }) => localDate(deadline).slice(0, 7) === state.month), ({ deadline }) => localDate(deadline));
  const cells = Array.from({ length: firstWeekday }, () => `<div class="calendar-cell is-blank" aria-hidden="true"></div>`);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${state.month}-${String(day).padStart(2, "0")}`;
    const list = byDay.get(key) ?? [];
    const today = key === shanghaiDateKey(new Date());
    cells.push(`<div class="calendar-cell ${today ? "is-today" : ""}"><div class="cell-date">${day}${today ? `<span>今天</span>` : ""}</div><div class="cell-events">${list.slice(0, 3).map(({ conference, deadline }) => `<a href="${escapeHtml(deadline.source)}" target="_blank" rel="noopener noreferrer" class="calendar-event field-${escapeHtml(conference.field)} ${!isUpcoming(deadline) ? "is-past" : ""}" title="${escapeHtml(`${conference.acronym} · ${deadline.label} · ${deadline.originalTime}`)}"><strong>${escapeHtml(conference.acronym)}</strong><span>${escapeHtml(deadline.label)}</span></a>`).join("")}${list.length > 3 ? `<span class="cell-more">另有 ${list.length - 3} 项</span>` : ""}</div></div>`);
  }
  const remainder = (7 - cells.length % 7) % 7;
  for (let i = 0; i < remainder; i++) cells.push(`<div class="calendar-cell is-blank" aria-hidden="true"></div>`);
  $("#calendar-view").innerHTML = `<div class="calendar-toolbar"><div><p class="section-kicker">MONTH AT A GLANCE</p><h3>${escapeHtml(monthTitle(state.month))}</h3></div><div class="calendar-nav"><button type="button" data-calendar="-1" aria-label="上个月">←</button><button type="button" data-calendar="today">本月</button><button type="button" data-calendar="1" aria-label="下个月">→</button></div></div><div class="calendar-scroll"><div class="calendar-grid"><div class="calendar-weekday">周一</div><div class="calendar-weekday">周二</div><div class="calendar-weekday">周三</div><div class="calendar-weekday">周四</div><div class="calendar-weekday">周五</div><div class="calendar-weekday">周六</div><div class="calendar-weekday">周日</div>${cells.join("")}</div></div><div class="calendar-foot"><span class="calendar-foot-dot"></span>仅显示官方已公布的日期；灰色表示该节点已过。</div>`;
}

function visibleConferences() {
  const filtered = filterConferences(conferences, state);
  if (!state.topic.trim()) return { filtered, matches: [], totalMatches: 0 };
  const allMatches = matchConferences(conferences, state.topic);
  const allowed = new Set(filtered.map((conference) => conference.id));
  const matches = allMatches.filter(({ conference }) => allowed.has(conference.id));
  return { filtered: matches.map(({ conference }) => conference), matches, totalMatches: allMatches.length };
}

function render() {
  renderStats();
  renderFilters();
  const { filtered, matches, totalMatches } = visibleConferences();
  renderHero(filtered);
  $("#clear-topic").hidden = !state.topic;
  $("#result-label").textContent = state.topic.trim()
    ? `已收录 ${conferences.length} 场中匹配 ${totalMatches} 场${filtered.length !== totalMatches ? ` · 当前筛选显示 ${filtered.length} 场` : ""}`
    : `找到 ${filtered.length} 场会议`;
  $("#time-note").textContent = state.view === "timeline" ? "具体时刻换算为北京时间" : "无具体时刻的节点按官网日期显示";
  $("#timeline-view").hidden = state.view !== "timeline";
  $("#calendar-view").hidden = state.view !== "calendar";
  for (const button of $("#view-switch").querySelectorAll("button")) {
    const selected = button.dataset.view === state.view;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  if (state.view === "timeline") {
    if (state.topic.trim()) renderMatchTimeline(matches, totalMatches);
    else renderTimeline(filtered);
  }
  else renderCalendar(filtered);
}

function downloadIcs(entries, filename) {
  if (!entries.length) return;
  const blob = new Blob([toIcs(entries)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("#topic-search").addEventListener("input", (event) => {
  if (!state.topic.trim() && event.target.value.trim()) { state.field = "all"; state.status = "all"; }
  state.topic = event.target.value;
  render();
});
$("#clear-topic").addEventListener("click", () => { state.topic = ""; $("#topic-search").value = ""; render(); $("#topic-search").focus(); });
$(".topic-examples").addEventListener("click", (event) => { const button = event.target.closest("[data-topic-example]"); if (!button) return; state.topic = button.dataset.topicExample; state.field = "all"; state.status = "all"; $("#topic-search").value = state.topic; render(); $("#topic-search").focus(); });
$("#search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
$("#field-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-field]"); if (button) { state.field = button.dataset.field; render(); } });
$("#status-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-status]"); if (button) { state.status = button.dataset.status; render(); } });
$("#view-switch").addEventListener("click", (event) => { const button = event.target.closest("[data-view]"); if (button) { state.view = button.dataset.view; render(); } });
$("#calendar-view").addEventListener("click", (event) => { const button = event.target.closest("[data-calendar]"); if (!button) return; if (button.dataset.calendar === "today") { state.month = shanghaiDateKey(new Date()).slice(0, 7); render(); } else changeMonth(Number(button.dataset.calendar)); });
$("#timeline-view").addEventListener("click", (event) => { const clearButton = event.target.closest("[data-clear-filters]"); if (clearButton) { state.field = "all"; state.status = "all"; state.query = ""; $("#search").value = ""; render(); return; } const button = event.target.closest("[data-export]"); if (!button) return; const conference = conferences.find((item) => item.id === button.dataset.export); if (conference) downloadIcs(getUpcomingMilestones([conference]), `${conference.acronym.toLowerCase()}-deadlines.ics`); });
$("#export-ics").addEventListener("click", () => { const { filtered } = visibleConferences(); downloadIcs(getUpcomingMilestones(filtered), "paper-timeline-deadlines.ics"); });
document.addEventListener("keydown", (event) => { if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) { event.preventDefault(); $("#search").focus(); } });

$("#verified-on").textContent = `官方信息核对于 ${niceDate(verifiedOn)}`;
render();
