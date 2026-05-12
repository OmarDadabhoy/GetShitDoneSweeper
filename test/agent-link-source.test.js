import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectTasks } from "../src/sources.js";

test("agent link source turns agent JSON into tasks", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-agent-link-"));
  const script = path.join(root, "source-agent.mjs");
  fs.writeFileSync(
    script,
    "process.stdout.write(JSON.stringify([{title:'Do linked thing', location:'doc:1', source_item_ref:'block-1'}]));\n",
  );
  const config = path.join(root, "sources.json");
  fs.writeFileSync(config, JSON.stringify({ sources: [] }));

  const tasks = await collectTasks(config, {
    root,
    sourceUrl: "https://example.com/todo",
    sourceAgentCommand: `node ${script}`,
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Do linked thing");
  assert.equal(tasks[0].writeback.type, "agent_link");
  assert.equal(tasks[0].writeback.item_ref, "block-1");
});
