# Get Shit Done Sweeper

A ClawSweeper-style orchestrator for personal todos. It reads tasks, claims each one, runs Codex/Claude workers in parallel, marks tasks done or blocked, emails you, then keeps checking on a schedule.

Use this for the multi-worker version. Use `Get-Shit-Done` for the lighter slash-command skill.

## Install

```bash
git clone git@github.com:OmarDadabhoy/GetShitDoneSweeper.git
cd GetShitDoneSweeper
corepack enable
pnpm install --frozen-lockfile
cp config/sources.example.json config/sources.json
cp config/notifications.example.json config/notifications.json
```

## Run

Dry run:

```bash
pnpm run sweep -- --mode dry-run --max-workers 2
```

With a Notion or Google Docs link:

```bash
pnpm run sweep -- --source-url 'https://www.notion.so/...' --mode dry-run --max-workers 2
```

`--source-url` asks an agent to read the link using whatever Codex/Claude already has: MCP, app connectors, installed skills, browser tools, and authenticated CLIs. No separate Notion/Google token is required for that path if the agent runtime already has access.

## Agent Runtime

Codex is the default for source reading and worker execution.

```bash
pnpm run sweep -- --agent codex --source-url 'https://www.notion.so/...' --mode dry-run
```

Use Claude Code instead:

```bash
pnpm run sweep -- --agent claude --source-url 'https://www.notion.so/...' --mode dry-run
```

Split source reading from worker execution:

```bash
# Claude Code reads Notion/Google Docs; Codex executes worker jobs
pnpm run sweep -- --source-agent claude --agent codex --source-url 'https://www.notion.so/...' --mode dry-run

# Codex reads Notion/Google Docs; Claude Code executes worker jobs
pnpm run sweep -- --source-agent codex --agent claude --source-url 'https://www.notion.so/...' --mode dry-run
```

Set defaults with env vars:

```bash
export GSD_AGENT=claude
export GSD_SOURCE_AGENT=claude
```

Use `--agent-command` or `--source-agent-command` only when you need a custom runtime command.

Execute:

```bash
GSD_ALLOW_EXECUTE=1 pnpm run sweep -- --agent claude --source-url 'https://www.notion.so/...' --mode execute --max-workers 2 --workspace /path/to/workspace
```

Watch every 20-30 minutes:

```bash
GSD_ALLOW_EXECUTE=1 pnpm run watch -- --agent claude --source-url 'https://www.notion.so/...' --interval 1800 --jitter 600 --mode execute --max-workers 2
```

## Sources

Edit `config/sources.json`.

Quick link mode:

```bash
pnpm run sweep -- --source-url 'YOUR_NOTION_OR_GOOGLE_DOC_LINK' --mode dry-run
```

This uses the current Codex/Claude runtime's existing access. For direct wrapper-managed writes, use permanent config.

Permanent config:

Google Docs:

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

Notion:

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

For email, put your address in `config/notifications.json` or set:

```bash
export GSD_EMAIL_TO='you@example.com'
```

## Guarantees

- Uses your local environment first: `AGENTS.md`, `CLAUDE.md`, installed skills, MCP/app connectors, and authenticated CLIs.
- Uses one overarching drain goal plus one goal per worker job.
- Claims source items in-progress before workers run.
- Refuses to mark tasks done or blocked unless they are already in-progress.
- Marks completed work in the source and emails after every completed task when an email recipient is available.
- Skips tasks already in-progress, done, or blocked so multiple agents do not intentionally collide.

Google Docs claims use revision checks. Notion and local files re-check the current marker before each transition. For `--source-url`, the worker uses the agent runtime's Notion/Google tools to claim and complete the exact item because the Node wrapper cannot directly call runtime-only MCP/app tools.

## Check

```bash
pnpm run check
```

Real config files are gitignored. Commit only `config/*.example.json`.
