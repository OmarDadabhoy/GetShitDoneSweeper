import assert from "node:assert/strict";
import test from "node:test";
import { hermesArgs, openClawArgs } from "../src/runtimes.js";

test("hermes runtime command includes skills and model", () => {
  const previousSkills = process.env.GSD_HERMES_SKILLS;
  process.env.GSD_HERMES_SKILLS = "codex,github";
  try {
    assert.deepEqual(hermesArgs("Do task", "anthropic/claude-sonnet-4"), [
      "chat",
      "-s",
      "codex",
      "-s",
      "github",
      "--model",
      "anthropic/claude-sonnet-4",
      "-q",
      "Do task",
    ]);
  } finally {
    if (previousSkills === undefined) delete process.env.GSD_HERMES_SKILLS;
    else process.env.GSD_HERMES_SKILLS = previousSkills;
  }
});

test("openclaw runtime command requires routing and supports local timeout", () => {
  const previousAgent = process.env.GSD_OPENCLAW_AGENT;
  const previousLocal = process.env.GSD_OPENCLAW_LOCAL;
  const previousTimeout = process.env.GSD_OPENCLAW_TIMEOUT;
  process.env.GSD_OPENCLAW_AGENT = "ops";
  process.env.GSD_OPENCLAW_LOCAL = "1";
  process.env.GSD_OPENCLAW_TIMEOUT = "120";
  try {
    assert.deepEqual(openClawArgs("Do task"), [
      "agent",
      "--agent",
      "ops",
      "--timeout",
      "120",
      "--local",
      "--message",
      "Do task",
    ]);
  } finally {
    restore("GSD_OPENCLAW_AGENT", previousAgent);
    restore("GSD_OPENCLAW_LOCAL", previousLocal);
    restore("GSD_OPENCLAW_TIMEOUT", previousTimeout);
  }
});

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
