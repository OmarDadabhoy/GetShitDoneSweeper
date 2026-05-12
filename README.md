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

Execute:

```bash
GSD_ALLOW_EXECUTE=1 pnpm run sweep -- --mode execute --max-workers 2 --workspace /path/to/workspace
```

Watch every 20-30 minutes:

```bash
GSD_ALLOW_EXECUTE=1 pnpm run watch -- --interval 1800 --jitter 600 --mode execute --max-workers 2
```

## Sources

Edit `config/sources.json`.

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

Google Docs claims use revision checks. Notion and local files re-check the current marker before each transition.

## Check

```bash
pnpm run check
```

Real config files are gitignored. Commit only `config/*.example.json`.
