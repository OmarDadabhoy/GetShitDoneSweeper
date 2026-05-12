import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "./fs-utils.js";

export function activateGoal(root, job) {
  const goal = {
    status: "active",
    job_id: job.job_id,
    task_id: job.task?.task_id,
    task: job.task?.title ?? "",
    source_id: job.task?.source_id ?? "",
    source_type: job.task?.source_type ?? "",
    location: job.task?.location ?? "",
    started_at: new Date().toISOString(),
  };
  writeGoal(root, goal);
  return goal;
}

export function closeGoal(root, status, details = {}) {
  const goal = readGoal(root) ?? {};
  const closed = {
    ...goal,
    ...details,
    status,
    finished_at: new Date().toISOString(),
  };
  writeGoal(root, closed);
  appendGoalHistory(root, closed);
  return closed;
}

function currentGoalPath(root) {
  return path.join(root, "state", "current_goal.json");
}

function currentGoalMarkdownPath(root) {
  return path.join(root, "state", "current_goal.md");
}

function readGoal(root) {
  const file = currentGoalPath(root);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeGoal(root, goal) {
  const stateDir = path.join(root, "state");
  ensureDir(stateDir);
  writeJson(currentGoalPath(root), goal);
  fs.writeFileSync(
    currentGoalMarkdownPath(root),
    [
      "# Current Goal",
      "",
      `Status: ${goal.status ?? ""}`,
      `Task: ${goal.task ?? ""}`,
      `Source: ${goal.source_id ?? ""}`,
      `Job: ${goal.job_id ?? ""}`,
      `Started: ${goal.started_at ?? ""}`,
      "",
    ].join("\n"),
  );
}

function appendGoalHistory(root, goal) {
  const file = path.join(root, "state", "goal_history.jsonl");
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(goal)}\n`);
}
