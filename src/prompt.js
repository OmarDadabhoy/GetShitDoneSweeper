import fs from "node:fs";
import path from "node:path";

export function renderWorkerPrompt({ root, job, mode, workspace }) {
  const systemPath = path.join(root, "prompts", "worker-system.md");
  const system = fs.readFileSync(systemPath, "utf8").trim();
  const currentGoalPath = path.join(root, "state", "current_goal.md");
  const overarchingGoalPath = path.join(root, "state", "overarching_goal.md");

  return `${system}

## Mode

${mode}

## Workspace

${workspace}

## Job

\`\`\`json
${JSON.stringify(job, null, 2)}
\`\`\`

## Goal Mode (do this FIRST, before any task work)

The wrapper has already written your active goal to ${currentGoalPath} and the parent drain goal to ${overarchingGoalPath}. Use the task title from the Job block above as `<task title>` in the calls below.

- Codex: call `create_goal("<task title>")` as your very first tool call. If a prior goal is open, call `close_goal` first.
- Claude Code: call `TaskCreate({subject: "<task title>", description: "<one-line context>"})` then `TaskUpdate(taskId, status: "in_progress")` as your very first tool calls. This is Claude Code's `create_goal` analog. Close with `TaskUpdate(taskId, status: "completed")` at end of turn. Also restate the goal verbatim in your first reply line as `Goal: <task title>`.
- Hermes: read ${currentGoalPath} and acknowledge `Goal: <task title>` in your first reply line.
- OpenClaw: acknowledge `Goal: <task title>` in your first turn and reference ${currentGoalPath}.

If your runtime exposes no goal-mode API and ${currentGoalPath} is missing, stop with status `needs_human` and the blocker "Goal mode unavailable in this runtime".

After the task is complete or blocked, clearly state done, blocked, or needs_human with verification so the wrapper can close the goal via `closeGoal`.

## Source Claiming

- If \`job.task.writeback.type\` is \`agent_link\`, the wrapper can only delegate source updates. Use your runtime Notion/Google Docs/Sheets/MCP/app tools to mark the exact item in-progress before doing task work.
- For \`agent_link\`, also mark the exact source item done or blocked before your final response. Use the writeback hints in the job JSON.
- For \`agent_link\`, append any useful suggestions to the source under \`Suggested Changes\` before your final response.
- If you cannot update the source status, stop with status \`needs_human\`.

## Execution Notes

- First load the local operating context that applies to ${workspace}: AGENTS.md, CLAUDE.md, SKILL.md, user-level agent instructions, installed skills, MCP/app connectors, and authenticated CLIs.
- Prefer the user's existing tools and skills over duplicate credentials or local source config.
- If this task is about code, inspect the workspace before editing.
- If this task is about GitHub, use the provided source ref and local/CLI context available to you.
- If this task came from Google Docs, Notion, Sheets, Gmail, GitHub, or another connected system, use existing runtime capabilities when available: MCP servers, app connectors, installed skills, first-party tools, browser tools, or authenticated CLIs.
- Do not attempt source write-back unless explicit editing tools are available and the user/source policy allows it; the wrapper normally owns claim/done/blocked source updates.
- Write your result in plain text with status, summary, verification, needs_from_user, and suggested_changes when useful. The wrapper stores this run's prompt, logs, and result.
`;
}
