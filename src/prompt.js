import fs from "node:fs";
import path from "node:path";

export function renderWorkerPrompt({ root, job, mode, workspace }) {
  const systemPath = path.join(root, "prompts", "worker-system.md");
  const system = fs.readFileSync(systemPath, "utf8").trim();
  const currentGoalPath = path.join(root, "state", "current_goal.md");

  return `${system}

## Mode

${mode}

## Workspace

${workspace}

## Job

\`\`\`json
${JSON.stringify(job, null, 2)}
\`\`\`

## Goal Mode

Before doing any task work, activate goal mode for this job:

- In Codex, call create_goal with the task title as the concrete objective when goal tools are available.
- In Claude Code or other agents, use the already-written fallback goal file at ${currentGoalPath}.

After the task is complete or blocked, clearly state done, blocked, or needs_human with verification so the wrapper can close the goal.

## Execution Notes

- If this task is about code, inspect the workspace before editing.
- If this task is about GitHub, use the provided source ref and local/CLI context available to you.
- If this task came from Google Docs, Notion, Sheets, Gmail, GitHub, or another connected system, use existing runtime capabilities when available: MCP servers, app connectors, installed skills, first-party tools, browser tools, or authenticated CLIs.
- Do not attempt source write-back unless explicit editing tools are available and the user/source policy allows it; the wrapper normally owns claim/done/blocked source updates.
- Write your result in plain text. The wrapper stores this run's prompt, logs, and result.
`;
}
