import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeHandoffReport } from "../src/handoff-report.js";

test("handoff report includes task, status, and user needs", () => {
  const previous = process.env.GSD_OPEN_HTML;
  process.env.GSD_OPEN_HTML = "0";
  try {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-report-"));
    const report = writeHandoffReport({
      runDir,
      job: {
        job_id: "job-1",
        task: {
          title: "Check payment",
          source_id: "notion",
          source_type: "agent_link",
          source_item_ref: "block-1",
        },
      },
      result: {
        status: "needs_human",
        summary: "Stripe needs login",
        verification: "2FA required",
        needs_from_user: "Approve the Stripe 2FA prompt.",
      },
    });

    assert.equal(report.opened, false);
    const html = fs.readFileSync(report.path, "utf8");
    assert.match(html, /Check payment/);
    assert.match(html, /needs_human/);
    assert.match(html, /Approve the Stripe 2FA prompt/);
  } finally {
    if (previous === undefined) {
      delete process.env.GSD_OPEN_HTML;
    } else {
      process.env.GSD_OPEN_HTML = previous;
    }
  }
});
