# Get Shit Done Sweeper

Clawsweeper-style task runner for personal todo sources. It reads tasks from Google Docs, Notion, local files, or GitHub issues, creates one job per task, and fans jobs out to Codex workers.

Use this when you want the automated multi-worker version. Use `Get-Shit-Done` when you just want the single-agent skill.

## Install

```bash
git clone git@github.com:OmarDadabhoy/GetShitDoneSweeper.git
cd GetShitDoneSweeper
node --version   # needs Node 20+
```

No install step is required right now; there are no runtime dependencies.

## Run

Dry-run first:

```bash
npm run sweep -- --mode dry-run --max-workers 2
```

That reads sources, creates jobs, and writes prompts under `state/runs` without invoking Codex.

Execute with Codex:

```bash
GSD_ALLOW_EXECUTE=1 npm run sweep -- --mode execute --max-workers 2 --workspace /path/to/workspace
```

Poll every 20-30 minutes:

```bash
npm run watch -- --interval 1800 --jitter 600 --mode dry-run
```

## Connect Google Docs

Edit `config/sources.json`:

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

Write-back options:

- `mark_done`: `[ ]` becomes `[x]`, `TODO` becomes `DONE`
- `delete`: clears the task paragraph
- `none`: read only

For private docs, authenticate with `gcloud`, `token_env`, or `token_command`.

## Connect Notion

Create a Notion integration, share the page with it, then:

```bash
export NOTION_TOKEN='secret_...'
```

Edit `config/sources.json`:

```json
{
  "id": "notion-page",
  "type": "notion_page",
  "enabled": true,
  "url": "https://www.notion.so/YOUR_PAGE_ID",
  "token_env": "NOTION_TOKEN",
  "writeback": "mark_done"
}
```

Notion supports unchecked `to_do` blocks, `- [ ] Task`, and `TODO: Task`.

## Other Sources

Local file:

```json
{
  "id": "local-todo",
  "type": "text_file",
  "enabled": true,
  "path": "../todo.md"
}
```

GitHub issues:

```json
{
  "id": "github-issues",
  "type": "github_issues",
  "enabled": true,
  "repo": "owner/repo",
  "label": "get-shit-done"
}
```

## Email Me

Edit `config/notifications.json` and set `enabled` to `true`.

```json
{
  "enabled": true,
  "method": "command",
  "to": ["you@example.com"],
  "command": "mail -s {subject} {to} < {body_file}"
}
```

Workers email on completion and when they need human input. SMTP is also supported.

## Goal Mode

Every job becomes an active goal. Codex workers are prompted to call `create_goal`; other agents use `state/current_goal.md`. Finished goals append to `state/goal_history.jsonl`.

## Verify

```bash
npm test
node --check src/cli.js
node src/cli.js sources --config config/sources.json
```
