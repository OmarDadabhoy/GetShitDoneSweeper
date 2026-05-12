# Codex Instructions

This repo is the v2 orchestration project for "get shit done" automation.

Use the source intake -> job queue -> worker dispatch model:

1. Read configured sources in `config/sources.json`.
2. Create durable jobs in `state/jobs/queued`.
3. Dispatch bounded local workers.
4. Each worker renders one focused prompt and invokes one agent process.
5. Record prompts, logs, and results under `state/runs`.

Do not access private sources or execute externally visible actions unless the user has configured the source and the worker prompt asks for explicit approval when required.
