import { conferences, verifiedOn } from "../src/conferences.js";
import { FIELD_LABELS, getUpcomingMilestones } from "../src/dates.js";
import { conferenceProfiles, topicCatalog } from "../src/topic-data.js";

const errors = [];
const ids = new Set();
const deadlineIds = new Set();
const topicIds = new Set();
const url = (value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn)) errors.push("verifiedOn must be YYYY-MM-DD");
for (const topic of topicCatalog) {
  if (!topic.id || topicIds.has(topic.id)) errors.push(`duplicate/missing topic id: ${topic.id}`);
  topicIds.add(topic.id);
  if (!topic.label || !Array.isArray(topic.aliases) || topic.aliases.length === 0) errors.push(`${topic.id}: missing label or aliases`);
}
for (const conference of conferences) {
  if (!conference.id || ids.has(conference.id)) errors.push(`duplicate/missing conference id: ${conference.id}`);
  ids.add(conference.id);
  if (!conference.acronym || !conference.name || !conference.nameZh || !conference.edition) errors.push(`${conference.id}: missing identity`);
  if (!FIELD_LABELS[conference.field]) errors.push(`${conference.id}: invalid field ${conference.field}`);
  if (!url(conference.cfp)) errors.push(`${conference.id}: invalid CFP URL`);
  const profile = conferenceProfiles[conference.id];
  if (!profile?.summary || !Array.isArray(profile.topicIds) || profile.topicIds.length === 0) errors.push(`${conference.id}: missing research profile`);
  const assigned = [...(profile?.topicIds ?? []), ...(profile?.relatedTopicIds ?? [])];
  for (const topicId of assigned) if (!topicIds.has(topicId)) errors.push(`${conference.id}: unknown topic ${topicId}`);
  if (new Set(assigned).size !== assigned.length) errors.push(`${conference.id}: duplicate topic assignment`);
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
for (const id of Object.keys(conferenceProfiles)) if (!ids.has(id)) errors.push(`${id}: profile has no conference`);

if (errors.length) {
  for (const error of errors) process.stderr.write(`ERROR ${error}\n`);
  process.exitCode = 1;
} else {
  const upcoming = getUpcomingMilestones(conferences, new Date(`${verifiedOn}T00:00:00Z`)).length;
  process.stdout.write(`Validated ${conferences.length} conferences, ${deadlineIds.size} sourced milestones, ${upcoming} future milestones as of ${verifiedOn}.\n`);
}
