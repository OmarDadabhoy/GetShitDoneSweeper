# Codex Instructions

This repo is the v2 orchestration project for "get shit done" automation.

Use the source intake -> job queue -> worker dispatch model:

1. Read configured sources in `config/sources.json`.
2. Create durable jobs in `state/jobs/queued`.
3. Activate an overarching drain goal.
4. Dispatch bounded local workers.
5. Each worker claims its source item in-progress before execution.
6. Each worker renders one focused prompt and invokes one agent process.
7. Each worker marks the source item done or blocked before closeout.
8. Record prompts, logs, results, source transitions, and goals under `state/`.

Workers must load the applicable local environment first: project `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, installed skills, MCP/app connectors, and authenticated CLIs. Do not skip claim-first source writeback, goal mode, or completion email behavior.

Do not access private sources or execute externally visible actions unless the user has configured the source and the worker prompt asks for explicit approval when required.
