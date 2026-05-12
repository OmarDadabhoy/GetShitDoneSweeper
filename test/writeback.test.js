import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { markTaskStatus } from "../src/writeback.js";

test("text writeback enforces todo to in-progress to done", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-writeback-"));
  const file = path.join(dir, "todo.md");
  fs.writeFileSync(file, "- [ ] Do this\n");

  const task = { writeback: { type: "text_file", path: file, line: 1 } };
  await markTaskStatus(task, "in-progress");
  assert.equal(fs.readFileSync(file, "utf8"), "- [>] Do this\n");

  await markTaskStatus(task, "done");
  assert.equal(fs.readFileSync(file, "utf8"), "- [x] Do this\n");

  await assert.rejects(() => markTaskStatus(task, "done"), /Claim it in-progress first/);
});
