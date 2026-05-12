#!/usr/bin/env node
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { repoRoot } from "./fs-utils.js";
import { intake } from "./intake.js";
import { dispatch } from "./dispatch.js";
import { collectTasks } from "./sources.js";
import { activateDrainGoal, closeDrainGoal } from "./goals.js";

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const root = path.resolve(args.root ?? repoRoot());
  const config = path.resolve(args.config ?? path.join(root, "config", "sources.json"));
  const mode = args.mode ?? "dry-run";
  const maxWorkers = Number(args["max-workers"] ?? args.max_workers ?? 2);
  const workspace = path.resolve(args.workspace ?? root);
  const model = args.model;
  const agentCommand = args["agent-command"] ?? process.env.GSD_AGENT_CMD;

  if (command === "sources") {
    console.log(JSON.stringify(await collectTasks(config), null, 2));
    return;
  }

  if (command === "intake") {
    console.log(JSON.stringify(await intake({ root, config }), null, 2));
    return;
  }

  if (command === "dispatch") {
    console.log(
      JSON.stringify(await dispatch({ root, maxWorkers, mode, workspace, model, agentCommand }), null, 2),
    );
    return;
  }

  if (command === "sweep") {
    console.log(JSON.stringify(await drain({ root, config, maxWorkers, mode, workspace, model, agentCommand }), null, 2));
    return;
  }

  if (command === "watch") {
    const interval = Number(args.interval ?? 1800);
    const jitter = Number(args.jitter ?? 600);
    while (true) {
      console.log(JSON.stringify(await drain({ root, config, maxWorkers, mode, workspace, model, agentCommand }), null, 2));
      const wait = interval + (jitter > 0 ? Math.floor(Math.random() * jitter) : 0);
      console.log(`sleeping ${wait}s`);
      await sleep(wait * 1000);
    }
  }

  throw new Error("usage: node src/cli.js sources|intake|dispatch|sweep|watch [options]");
}

async function drain({ root, config, maxWorkers, mode, workspace, model, agentCommand }) {
  activateDrainGoal(root);
  const cycles = [];
  while (true) {
    const intakeResult = await intake({ root, config });
    const dispatchResult = await dispatch({ root, maxWorkers, mode, workspace, model, agentCommand });
    cycles.push({ intake: intakeResult, dispatch: dispatchResult });

    if (intakeResult.jobs_created === 0 && dispatchResult.jobs_seen === 0) {
      closeDrainGoal(root, "done", {
        summary: `Drain finished after ${cycles.length} cycle(s); no queued jobs remain.`,
      });
      return { cycles, status: "done" };
    }

    if (mode === "dry-run") {
      closeDrainGoal(root, "planned", {
        summary: "Dry run stopped after rendering available worker prompts.",
      });
      return { cycles, status: "planned" };
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
