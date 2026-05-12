# Get Shit Done Sweeper

Clawsweeper-inspired personal task orchestrator.

This is V2: a separate project from `TodoSkill`. `TodoSkill` teaches one agent how to complete one todo. Get Shit Done Sweeper reads configured sources, creates durable job files, and fans those jobs out to bounded Codex workers.

## Install

Clone the repo:

```bash
git clone git@github.com:OmarDadabhoy/GetShitDoneSweeper.git
cd GetShitDoneSweeper
```

Use Node 20 or newer:

```bash
node --version
```

There are currently no runtime package dependencies. `npm install` is optional unless dependencies are added later.

## Quick Start

Dry-run the full pipeline:

```bash
npm run sweep -- --mode dry-run --max-workers 2
```

This does three things:

1. Reads sources from `config/sources.json`.
2. Creates durable jobs under `state/jobs/queued`.
3. Renders worker prompts under `state/runs` without invoking Codex.

Inspect generated prompts:

```bash
find state/runs -name prompt.md -print
```

## Configure Sources

Edit `config/sources.json`.

Supported source types:

- `text_file`: parse `- [ ] ...` and `TODO: ...` from a local Markdown/text file.
- `google_docs`: parse the plain-text export of a Google Doc.
- `notion_page`: read tasks from a Notion page and write back completion.
- `github_issues`: read open GitHub issues through the `gh` CLI.

### Local Text File

```json
{
  "id": "local-todo",
  "type": "text_file",
  "enabled": true,
  "path": "../../TodoSkill/inbox/todo.md"
}
```

Paths are resolved relative to `config/sources.json`.

### Google Docs

Public or published doc:

```json
{
  "id": "google-docs",
  "type": "google_docs",
  "enabled": true,
  "url": "https://docs.google.com/document/d/YOUR_DOCUMENT_ID/edit",
  "auth": "public",
  "writeback": "none"
}
```

Private doc using `gcloud`:

```json
{
  "id": "google-docs",
  "type": "google_docs",
  "enabled": true,
  "document_id": "YOUR_DOCUMENT_ID",
  "auth": "gcloud",
  "writeback": "mark_done"
}
```

Private auth can also use:

- `token_env`: environment variable containing a Bearer token.
- `token_command`: command that prints a Bearer token.

Google Docs write-back modes:

- `mark_done`: replace `[ ]` with `[x]`, or replace `TODO` with `DONE`.
- `delete`: clear the task paragraph text while leaving the paragraph break in place.
- `none`: read only.

Write-back happens after a worker finishes successfully in `execute` mode. It uses the Google Docs API, so the token needs Docs read/write access.

### Notion Page

Create a Notion integration, share the page with it, then set:

```bash
export NOTION_TOKEN='secret_...'
```

Enable the source:

```json
{
  "id": "notion-page",
  "type": "notion_page",
  "enabled": true,
  "url": "https://www.notion.so/YOUR_PAGE_ID",
  "token_env": "NOTION_TOKEN",
  "writeback": "mark_done",
  "recursive": false
}
```

Supported Notion task blocks:

- unchecked Notion `to_do` blocks
- paragraph/list blocks containing `- [ ] Task`
- paragraph/list blocks containing `TODO: Task`

Notion write-back modes:

- `mark_done`: check Notion `to_do` blocks, replace `[ ]` with `[x]`, or replace `TODO` with `DONE`.
- `delete`: archive the Notion block.

### GitHub Issues

```json
{
  "id": "github-issues",
  "type": "github_issues",
  "enabled": true,
  "repo": "owner/repo",
  "label": "get-shit-done",
  "limit": 20
}
```

Requires the GitHub CLI:

```bash
gh auth status
```

## Commands

List tasks visible from configured sources:

```bash
node src/cli.js sources --config config/sources.json
```

Create queued jobs only:

```bash
npm run intake -- --config config/sources.json
```

Dispatch queued jobs in dry-run mode:

```bash
npm run dispatch -- --mode dry-run --max-workers 2
```

Run intake plus dispatch:

```bash
npm run sweep -- --mode dry-run --max-workers 2
```

Poll every 20-30 minutes:

```bash
npm run watch -- --interval 1800 --jitter 600 --mode dry-run
```

## Execute With Codex

Execution is deliberately gated. Dry-run first, inspect prompts, then run:

```bash
GSD_ALLOW_EXECUTE=1 npm run dispatch -- --mode execute --max-workers 2 --workspace /path/to/workspace
```

By default the worker invokes:

```bash
codex exec --cd <workspace> --model gpt-5.5 --sandbox danger-full-access
```

Use a custom agent command with placeholders:

```bash
GSD_ALLOW_EXECUTE=1 \
GSD_AGENT_CMD='your-agent-command {prompt_file}' \
npm run dispatch -- --mode execute --max-workers 2
```

Available placeholders:

- `{prompt_file}`: path to the rendered prompt.
- `{run_dir}`: run output directory.
- `{workspace}`: workspace passed to the worker.

## State

```text
state/
  jobs/
    queued/
    running/
    done/
    blocked/
  runs/
    <job-id>-<timestamp>/
      prompt.md
      result.json
      agent.stdout.log
      agent.stderr.log
```

Generated jobs and runs are ignored by git. The `.gitkeep` files keep the directory shape.

## Safety Model

- One source item becomes one job.
- One worker handles one job.
- `execute` mode refuses to run unless `GSD_ALLOW_EXECUTE=1`.
- Workers ask before externally visible or destructive actions.
- Private sources are opt-in through config.
- Every run stores the exact prompt sent to the agent.
- Completion and needs-human notifications are opt-in through `config/notifications.json`.

## Email Notifications

Notifications are disabled by default. Configure `config/notifications.json`.

Command-based email example:

```json
{
  "enabled": true,
  "method": "command",
  "to": ["you@example.com"],
  "subject_prefix": "[Get Shit Done]",
  "command": "mail -s {subject} {to} < {body_file}"
}
```

SMTP example:

```json
{
  "enabled": true,
  "method": "smtp",
  "to": ["you@example.com"],
  "subject_prefix": "[Get Shit Done]",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "starttls": true,
    "from": "you@example.com",
    "username_env": "SMTP_USERNAME",
    "password_env": "SMTP_PASSWORD"
  }
}
```

Workers send `done` after successful completion and `needs_human` when blocked or waiting on input.

## Relation To Clawsweeper

The borrowed idea is operational, not a direct copy:

- Clawsweeper scans GitHub issues/PRs and dispatches bounded Codex repair workers.
- This project scans personal task sources and dispatches bounded Codex workers.
- Both preserve durable state and run one scoped worker per job.

## Verify

Run:

```bash
npm test
node --check src/cli.js
node --check src/worker.js
node --check src/sources.js
node src/cli.js sources --config config/sources.json
```

## Troubleshooting

If no jobs are created, run:

```bash
node src/cli.js sources --config config/sources.json
```

If Google Docs returns 401 or 403, make the doc public/published for read-only mode, or configure `auth: "gcloud"`, `token_env`, or `token_command` with Docs read/write scope for write-back.

If Notion returns 401, 403, or 404, confirm `NOTION_TOKEN` is set and the page has been shared with the integration.

If `github_issues` fails, run `gh auth status` and confirm the repo name and label.

If workers stay in dry-run, switch `--mode execute` and set `GSD_ALLOW_EXECUTE=1`.
