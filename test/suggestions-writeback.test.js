import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendTaskSuggestions } from "../src/writeback.js";

test("text writeback appends suggested changes section", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-suggestions-"));
  const file = path.join(dir, "todo.md");
  fs.writeFileSync(file, "- [>] Do this\n");

  const result = await appendTaskSuggestions(
    {
      title: "Do this",
      writeback: { type: "text_file", path: file, line: 1 },
    },
    ["Try a shorter onboarding flow."],
  );

  assert.equal(result.status, "appended");
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /## Suggested Changes/);
  assert.match(text, /Do this/);
  assert.match(text, /Try a shorter onboarding flow/);
});
