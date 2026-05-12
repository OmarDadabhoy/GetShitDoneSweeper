import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createQueuedJobs, queuedJobFiles } from "../src/jobs.js";

test("job creation is idempotent by task id", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-sweeper-"));
  const task = {
    task_id: "abc123",
    source_id: "local",
    source_type: "text_file",
    title: "Do the thing",
    location: "/tmp/todo.md:1",
  };

  assert.equal(createQueuedJobs(root, [task]).length, 1);
  assert.equal(createQueuedJobs(root, [task]).length, 0);
  assert.equal(queuedJobFiles(root).length, 1);
});
