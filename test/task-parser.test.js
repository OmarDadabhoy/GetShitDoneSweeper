import assert from "node:assert/strict";
import test from "node:test";
import { parseTodoText, todoLineStatus, updateTodoLineStatus } from "../src/task-parser.js";

test("parses actionable todo lines and ignores completed items", () => {
  const tasks = parseTodoText("- [ ] Do this\n- [x] Done\nTODO: Do that\n", {
    id: "local",
    type: "text_file",
    location: "/tmp/todo.md",
  });

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, "Do this");
  assert.equal(tasks[1].title, "Do that");
});

test("ignores todo examples inside fenced code blocks", () => {
  const tasks = parseTodoText("```markdown\n- [ ] Example\nTODO: Example\n```\n- [ ] Real\n", {
    id: "local",
    type: "text_file",
    location: "/tmp/todo.md",
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, "Real");
});

test("detects and updates task status markers", () => {
  assert.equal(todoLineStatus("- [ ] Do this"), "todo");
  assert.equal(todoLineStatus("- [>] Do this"), "in-progress");
  assert.equal(todoLineStatus("WIP Do this"), "in-progress");
  assert.equal(todoLineStatus("DONE Do this"), "done");

  assert.equal(updateTodoLineStatus("- [ ] Do this", "in-progress"), "- [>] Do this");
  assert.equal(updateTodoLineStatus("TODO: Do this", "done"), "DONE: Do this");
});
