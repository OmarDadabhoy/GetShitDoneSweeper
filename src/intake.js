import { collectTasks } from "./sources.js";
import { createQueuedJobs } from "./jobs.js";

export async function intake({ root, config, sourceUrl, sourceAgentCommand }) {
  const tasks = await collectTasks(config, { root, sourceUrl, sourceAgentCommand });
  const created = createQueuedJobs(root, tasks);
  return {
    tasks_seen: tasks.length,
    jobs_created: created.length,
    jobs: created.map((entry) => entry.file),
  };
}
