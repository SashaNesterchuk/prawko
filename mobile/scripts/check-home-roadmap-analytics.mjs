import fs from "node:fs";
import assert from "node:assert/strict";

const file = process.argv[2] ?? ".analytics/session.jsonl";
const names = new Set(["home_preparation_action_selected", "first_step_nudge_shown", "roadmap_lesson_progress_changed"]);
const events = fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse).filter((row) => names.has(row.event));
assert(events.length > 0, "No Home/roadmap events captured");
assert(events.every((row) => row.properties.analytics_payload_valid === true), "Invalid Home/roadmap payload");
assert(new Set(events.map((row) => row.properties.event_id)).size === events.length, "Duplicate event IDs");
assert(events.some((row) => row.event === "first_step_nudge_shown"), "Missing actual nudge exposure");
for (const action of ["statistics", "mistakes"]) {
  assert(events.some((row) => row.event === "home_preparation_action_selected" && row.properties.action === action && row.properties.destination === action), `Missing ${action} tap`);
}
for (const transition of ["completed", "reopened"]) {
  assert(events.some((row) => row.event === "roadmap_lesson_progress_changed" && row.properties.completion_transition === transition), `Missing ${transition} transition`);
}
for (const row of events.filter((row) => row.event === "roadmap_lesson_progress_changed")) {
  const p = row.properties;
  assert(p.correct_count + p.wrong_count <= p.question_total, "Overlapping coverage");
  assert.equal(p.completed, p.question_total > 0 && p.correct_count === p.question_total && p.wrong_count === 0);
  if (p.change_reason === "answer") {
    assert(p.question_id && p.training_session_id, "Native answer transition must join its source session/question");
    assert(p.correct_count !== p.previous_correct_count || p.wrong_count !== p.previous_wrong_count, "Unchanged answer emitted coverage event");
  }
}
console.log(JSON.stringify({ verified: true, events: events.length, counts: Object.fromEntries([...names].map((name) => [name, events.filter((row) => row.event === name).length])) }, null, 2));
