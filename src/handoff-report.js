import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ensureDir } from "./fs-utils.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function needsFromUser(result) {
  if (result.needs_from_user) return result.needs_from_user;
  if (result.needs_from_omar) return result.needs_from_omar;
  if (result.follow_up) return result.follow_up;
  if (result.status === "done") return "Nothing needed from you right now.";
  return result.summary || result.verification || "Review this task and provide the missing input.";
}

export function writeHandoffReport({ runDir, job, result }) {
  ensureDir(runDir);
  const task = job.task ?? {};
  const reportPath = path.join(runDir, "handoff.html");
  const data = {
    status: result.status ?? "blocked",
    task: task.title ?? "",
    summary: result.summary ?? "",
    verification: result.verification ?? "",
    needs_from_user: needsFromUser(result),
    source_id: task.source_id ?? "",
    source_type: task.source_type ?? "",
    item_ref: task.source_item_ref ?? task.item_id ?? "",
    location: task.location ?? "",
    job_id: job.job_id ?? "",
    run_dir: runDir,
    created_at: new Date().toISOString(),
  };
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.task)} - ${escapeHtml(data.status)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; max-width: 920px; color: #17202a; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 28px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #b8c2cc; border-radius: 6px; text-transform: uppercase; font-size: 12px; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 14px; border-radius: 6px; overflow-wrap: anywhere; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 16px; }
    dt { font-weight: 700; }
    dd { margin: 0; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <span class="status">${escapeHtml(data.status)}</span>
  <h1>${escapeHtml(data.task)}</h1>
  <h2>What Happened</h2>
  <pre>${escapeHtml(data.summary)}</pre>
  <h2>What You Need To Do</h2>
  <pre>${escapeHtml(data.needs_from_user)}</pre>
  <h2>Verification</h2>
  <pre>${escapeHtml(data.verification)}</pre>
  <h2>Details</h2>
  <dl>
    <dt>Source</dt><dd>${escapeHtml(data.source_id)}</dd>
    <dt>Type</dt><dd>${escapeHtml(data.source_type)}</dd>
    <dt>Item</dt><dd>${escapeHtml(data.item_ref)}</dd>
    <dt>Location</dt><dd>${escapeHtml(data.location)}</dd>
    <dt>Job</dt><dd>${escapeHtml(data.job_id)}</dd>
    <dt>Run</dt><dd>${escapeHtml(data.run_dir)}</dd>
    <dt>Created</dt><dd>${escapeHtml(data.created_at)}</dd>
  </dl>
  <script type="application/json" id="handoff-data">${escapeHtml(JSON.stringify(data, null, 2))}</script>
</body>
</html>
`;
  fs.writeFileSync(reportPath, html);
  return {
    path: reportPath,
    opened: openReport(reportPath),
  };
}

function openReport(reportPath) {
  const value = String(process.env.GSD_OPEN_HTML ?? "1").toLowerCase();
  if (["0", "false", "no"].includes(value)) return false;

  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", reportPath] : [reportPath];

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
