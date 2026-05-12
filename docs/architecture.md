# Architecture

This project borrows the useful operational shape from Clawsweeper without becoming a GitHub-only maintenance bot.

## Lanes

1. Intake lane reads configured sources and creates stable jobs.
2. Dispatch lane limits concurrency and starts workers.
3. Goal lane activates one overarching drain goal plus one current goal per worker task.
4. Worker lane renders scoped prompts and invokes one agent per job.
5. Write-back lane claims source items before execution and marks completed or blocked source items afterward.
6. Notification lane sends done or needs-human email when configured.
7. State lane preserves prompts, logs, results, goals, and job transitions.

## Guardrails

- A source item becomes one job.
- A worker handles one job and does not expand scope.
- Mutating execution requires `GSD_ALLOW_EXECUTE=1`.
- Private sources are opt-in through config.
- Every run stores the exact prompt that was sent to the agent.
- Goal state is written before every worker prompt and closed after success or block.
- Source write-back is a hard gate for writable sources: todo -> in-progress -> done/blocked.
- Email notification runs after success or blocker classification when any recipient is configured or provided by env.

## State Layout

```text
state/
  current_goal.json
  current_goal.md
  goal_history.jsonl
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
