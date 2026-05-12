# Get Shit Done Sweeper

Multi-worker todo orchestrator for Codex or Claude Code. It reads tasks, claims them, runs worker agents, marks done or blocked, emails you, then keeps checking.

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

```bash
# Dry run with Notion or Google Docs
pnpm run sweep -- --source-url 'YOUR_NOTION_OR_GOOGLE_DOC_LINK' --mode dry-run --max-workers 2

# Execute
GSD_ALLOW_EXECUTE=1 pnpm run sweep -- --source-url 'YOUR_LINK' --mode execute --max-workers 2 --workspace /path/to/workspace

# Watch every 20-30 minutes
GSD_ALLOW_EXECUTE=1 pnpm run watch -- --source-url 'YOUR_LINK' --mode execute --max-workers 2 --interval 1800 --jitter 600
```

## Codex or Claude

Codex is the default.

```bash
# Codex workers
pnpm run sweep -- --agent codex --source-url 'YOUR_LINK' --mode dry-run

# Claude Code workers
pnpm run sweep -- --agent claude --source-url 'YOUR_LINK' --mode dry-run

# Split source reading and workers
pnpm run sweep -- --source-agent claude --agent codex --source-url 'YOUR_LINK' --mode dry-run
pnpm run sweep -- --source-agent codex --agent claude --source-url 'YOUR_LINK' --mode dry-run

# Optional defaults
export GSD_AGENT=claude
export GSD_SOURCE_AGENT=claude
```

## Config

- `--source-url` uses whatever Codex/Claude can already access: MCP/app connectors, installed skills, browser tools, and authenticated CLIs.
- For wrapper-managed sources, edit `config/sources.json` using `config/sources.example.json`.
- For email, edit `config/notifications.json` or set:

```bash
export GSD_EMAIL_TO='you@example.com'
```

## Rules

Uses a drain goal plus one goal per worker, claims items before work, marks them done or blocked, opens an HTML handoff report, emails on completion, and skips in-progress/done/blocked items.

Real config files are gitignored. Commit only `config/*.example.json`.
