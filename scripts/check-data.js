import { conferences, verifiedOn } from "../src/conferences.js";
import { FIELD_LABELS, getUpcomingMilestones } from "../src/dates.js";

const errors = [];
const ids = new Set();
const deadlineIds = new Set();
const url = (value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn)) errors.push("verifiedOn must be YYYY-MM-DD");
for (const conference of conferences) {
  if (!conference.id || ids.has(conference.id)) errors.push(`duplicate/missing conference id: ${conference.id}`);
  ids.add(conference.id);
  if (!conference.acronym || !conference.name || !conference.nameZh || !conference.edition) errors.push(`${conference.id}: missing identity`);
  if (!FIELD_LABELS[conference.field]) errors.push(`${conference.id}: invalid field ${conference.field}`);
  if (!url(conference.cfp)) errors.push(`${conference.id}: invalid CFP URL`);
  if (!Array.isArray(conference.deadlines)) errors.push(`${conference.id}: deadlines is not an array`);
  for (const deadline of conference.deadlines ?? []) {
    if (!deadline.id || deadlineIds.has(deadline.id)) errors.push(`duplicate/missing deadline id: ${deadline.id}`);
    deadlineIds.add(deadline.id);
    if (!deadline.label || !deadline.kind || !deadline.originalTime) errors.push(`${deadline.id}: missing description`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.date) || Number.isNaN(Date.parse(`${deadline.date}T00:00:00Z`))) errors.push(`${deadline.id}: invalid date`);
    if (deadline.at && Number.isNaN(new Date(deadline.at).getTime())) errors.push(`${deadline.id}: invalid exact instant`);
    if (!url(deadline.source)) errors.push(`${deadline.id}: invalid source URL`);
  }
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`ERROR ${error}\n`);
  process.exitCode = 1;
} else {
  const upcoming = getUpcomingMilestones(conferences, new Date(`${verifiedOn}T00:00:00Z`)).length;
  process.stdout.write(`Validated ${conferences.length} conferences, ${deadlineIds.size} sourced milestones, ${upcoming} future milestones as of ${verifiedOn}.\n`);
}
