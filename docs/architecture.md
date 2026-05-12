# Architecture

This project borrows the useful operational shape from Clawsweeper without becoming a GitHub-only maintenance bot.

## Lanes

1. Intake lane reads configured sources and creates stable jobs.
2. Dispatch lane limits concurrency and starts workers.
3. Worker lane renders scoped prompts and invokes one agent per job.
4. Write-back lane marks completed source items when a source supports it.
5. Notification lane sends done or needs-human email when configured.
6. State lane preserves prompts, logs, results, and job transitions.

## Guardrails

- A source item becomes one job.
- A worker handles one job and does not expand scope.
- Mutating execution requires `GSD_ALLOW_EXECUTE=1`.
- Private sources are opt-in through config.
- Every run stores the exact prompt that was sent to the agent.
- Source write-back runs only after a worker reports success.
- Email notification is opt-in and runs after success or blocker classification.

## State Layout

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
