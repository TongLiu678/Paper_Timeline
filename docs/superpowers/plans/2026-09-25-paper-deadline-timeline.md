# Paper Deadline Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a Chinese-language, source-backed timetable for all conference series named in the supplied conversation, with a chronological list, month calendar, filters, and calendar export.

**Architecture:** A static browser app reads hand-checked records from an ES module. Each conference edition holds separate abstract, full-paper, ARR/commit, and round milestones with an official source link. Pure date functions drive both views and ICS export. GitHub Pages hosts the app without a backend.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in tests, GitHub Pages.

---

## File map

- `index.html`: page landmarks, controls, and app mount points.
- `styles.css`: visual system, responsive timeline/calendar, accessibility states.
- `src/conferences.js`: verified conference editions and deadlines.
- `src/dates.js`: pure filtering, time formatting, ordering, and ICS serialization.
- `src/app.js`: render and event handlers.
- `tests/dates.test.js`: fixed-clock date, filter, and ICS tests.
- `README.md`: usage, data policy, update process, deployment URL.
- `.github/workflows/pages.yml`: publish the static root on pushes to `main`.

## Task 1: Verify the data

- [ ] Extract the conference series named in the supplied conversation and use five equal-weight groups: AI/NLP, AI Infra/architecture, EDA, systems, and formal methods/PL.
- [ ] For each edition, store a conference URL and an official CFP/source URL. Record each stage as `{ label, kind, at, originalTime, source }`; `at` is ISO 8601 with an explicit UTC offset when the organizer states a time.
- [ ] Keep announced, past deadlines as historical facts. If the next edition has no official CFP, render `待公布` without a fabricated date or countdown.
- [ ] Mark the dataset's `verifiedOn` date and identify official dates and source links in the UI.

## Task 2: Date logic and tests

- [ ] Write `src/dates.js` exports: `getStatus`, `getNextMilestone`, `filterConferences`, `sortByNextMilestone`, `formatShanghaiTime`, and `toIcs`.
- [ ] Add fixed-clock tests for UTC−12 to Asia/Shanghai conversion, already-passed milestones, mixed Chinese/English name filtering, month grouping, and ICS escaping.
- [ ] Run `node --test`; all tests pass.

## Task 3: Browser interface

- [ ] Create a chronological timeline with one row per conference and the next official milestone prominent. Expand each row to show every published submission stage and its official source.
- [ ] Add a month calendar over the same published milestones, a search field, equal-weight field chips, and upcoming/all status controls.
- [ ] Label original conference time zone and the corresponding Beijing time when exact conversion is possible. Keep date-only announcements as date-only.
- [ ] Add a one-click `.ics` download per conference and a combined feed for all upcoming confirmed deadlines.
- [ ] Check 390px mobile and wide desktop layouts, keyboard focus, empty results, and links.

## Task 4: Publish

- [ ] Add a GitHub Pages workflow and concise README with the sources and manual update rule.
- [ ] Run `node --test`, static data validation, and a browser smoke test.
- [ ] Commit, create the authorized public GitHub repository, push `main`, enable Pages, and verify the public URL.

## Self-review

Each user requirement maps to a task: chronological conference deadline list, calendar view, five fields with equal prominence, official source and time zone, calendar export, and public GitHub publication. Exact and unpublished dates have separate display rules. File and function names remain consistent across tasks.
