import fs from "node:fs";
import path from "node:path";
import { ensureDir, findFiles, readJson, stableSlug, utcStamp, writeJson } from "./fs-utils.js";

const states = ["queued", "running", "done", "blocked"];

export function stateRoot(root) {
  return path.join(root, "state");
}

export function jobDir(root, state) {
  return path.join(stateRoot(root), "jobs", state);
}

export function allJobFiles(root) {
  return states.flatMap((state) => findFiles(jobDir(root, state)));
}

export function queuedJobFiles(root) {
  return findFiles(jobDir(root, "queued"));
}

export function knownTaskIds(root) {
  const ids = new Set();
  for (const file of allJobFiles(root)) {
    const job = readJson(file);
    if (job.task?.task_id) ids.add(job.task.task_id);
  }
  return ids;
}

export function createQueuedJobs(root, tasks) {
  const known = knownTaskIds(root);
  const created = [];

  for (const task of tasks) {
    if (known.has(task.task_id)) continue;
    const job = {
      job_id: `${task.task_id}-${stableSlug(task.title) || "task"}`,
      status: "queued",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      task,
    };
    const file = path.join(jobDir(root, "queued"), `${job.job_id}.json`);
    writeJson(file, job);
    known.add(task.task_id);
    created.push({ file, job });
  }

  return created;
}

export function transitionJob(file, nextState, patch = {}) {
  const job = readJson(file);
  const currentState = path.basename(path.dirname(file));
  const nextDir = path.join(path.dirname(path.dirname(file)), nextState);
  ensureDir(nextDir);
  const nextFile = path.join(nextDir, path.basename(file));
  const nextJob = {
    ...job,
    ...patch,
    status: nextState,
    previous_status: currentState,
    updated_at: new Date().toISOString(),
  };
  writeJson(nextFile, nextJob);
  if (path.resolve(nextFile) !== path.resolve(file)) fs.unlinkSync(file);
  return { file: nextFile, job: nextJob };
}

export function makeRunDir(root, job) {
  const dir = path.join(stateRoot(root), "runs", `${job.job_id}-${utcStamp()}`);
  ensureDir(dir);
  return dir;
}
