import path from "node:path";
import { spawn } from "node:child_process";
import { queuedJobFiles } from "./jobs.js";

export async function dispatch({ root, maxWorkers = 2, mode = "dry-run", workspace = root, agent, model, agentCommand }) {
  const jobs = queuedJobFiles(root);
  const results = [];
  let cursor = 0;
  let active = 0;

  return await new Promise((resolve) => {
    const launchNext = () => {
      while (active < maxWorkers && cursor < jobs.length) {
        const jobFile = jobs[cursor];
        cursor += 1;
        active += 1;

        runWorker({ root, jobFile, mode, workspace, agent, model, agentCommand }).then((result) => {
          results.push(result);
          active -= 1;
          launchNext();
        });
      }

      if (active === 0 && cursor >= jobs.length) {
        resolve({
          jobs_seen: jobs.length,
          jobs_finished: results.length,
          results,
        });
      }
    };

    launchNext();
  });
}

function runWorker({ root, jobFile, mode, workspace, agent, model, agentCommand }) {
  return new Promise((resolve) => {
    const args = [
      path.join(root, "src", "worker.js"),
      jobFile,
      "--root",
      root,
      "--mode",
      mode,
      "--workspace",
      workspace,
    ];
    if (model) args.push("--model", model);
    if (agent) args.push("--agent", agent);
    if (agentCommand) args.push("--agent-command", agentCommand);

    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ job_file: jobFile, exit_code: code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
