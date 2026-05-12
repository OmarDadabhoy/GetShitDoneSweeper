import fs from "node:fs";
import path from "node:path";

export function renderWorkerPrompt({ root, job, mode, workspace }) {
  const systemPath = path.join(root, "prompts", "worker-system.md");
  const system = fs.readFileSync(systemPath, "utf8").trim();

  return `${system}

## Mode

${mode}

## Workspace

${workspace}

## Job

\`\`\`json
${JSON.stringify(job, null, 2)}
\`\`\`

## Execution Notes

- If this task is about code, inspect the workspace before editing.
- If this task is about GitHub, use the provided source ref and local/CLI context available to you.
- If this task came from Google Docs, treat the doc as the source of the request; do not attempt write-back unless explicit editing tools are available and the user has approved it.
- Write your result in plain text. The wrapper stores this run's prompt, logs, and result.
`;
}
