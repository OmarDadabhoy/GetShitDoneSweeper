import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { todoLineStatus, updateTodoLineStatus } from "./task-parser.js";

export async function markTaskDone(task) {
  return await markTaskStatus(task, "done");
}

export async function markTaskStatus(task, status) {
  if (!task.writeback) return { status: "skipped", reason: "task has no writeback metadata" };
  if (task.writeback.type === "agent_link") return markAgentLinkStatus(task.writeback, status);
  if (task.writeback.type === "text_file") return markTextFileStatus(task.writeback, status);
  if (task.writeback.type === "google_docs") return await markGoogleDocsStatus(task.writeback, status);
  if (task.writeback.type === "notion_page") return await markNotionStatus(task.writeback, status);
  return { status: "skipped", reason: `unsupported writeback type: ${task.writeback.type}` };
}

function markAgentLinkStatus(writeback, status) {
  return {
    status: "delegated",
    target_status: status,
    reason: "source is only available through the worker agent runtime; worker prompt must update it with MCP/app tools",
    source_ref: writeback.source_ref ?? writeback.url,
    item_ref: writeback.item_ref ?? "",
  };
}

function requireTransition(writeback, currentStatus, targetStatus) {
  if (targetStatus === "in-progress" && currentStatus !== "todo") {
    throw new Error(`Cannot claim ${writeback.type} item; current status is ${currentStatus}.`);
  }
  if (["done", "blocked"].includes(targetStatus) && currentStatus !== "in-progress") {
    throw new Error(
      `Cannot mark ${writeback.type} item ${targetStatus}; current status is ${currentStatus}. Claim it in-progress first.`,
    );
  }
}

function markTextFileStatus(writeback, status) {
  const lines = fs.readFileSync(writeback.path, "utf8").split(/\r?\n/);
  const index = Number(writeback.line) - 1;
  if (index < 0 || index >= lines.length) throw new Error(`Text writeback line out of range: ${writeback.line}`);
  const currentStatus = todoLineStatus(lines[index]);
  requireTransition(writeback, currentStatus, status);
  lines[index] = updateTodoLineStatus(lines[index], status);
  fs.writeFileSync(writeback.path, `${lines.join("\n").replace(/\n*$/, "")}\n`);
  return { status, mode: "mark_status", path: writeback.path, line: writeback.line };
}

function googleBearerToken(writeback) {
  if (writeback.token_env && process.env[writeback.token_env]) {
    return process.env[writeback.token_env].trim();
  }

  if (writeback.token_command) {
    const result = spawnSync(writeback.token_command, { shell: true, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Google Docs token command failed.");
    }
    return result.stdout.trim();
  }

  if (writeback.auth === "gcloud") {
    const result = spawnSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "gcloud auth failed for Google Docs writeback.");
    }
    return result.stdout.trim();
  }

  return "";
}

async function markGoogleDocsStatus(writeback, status) {
  const token = googleBearerToken(writeback);
  if (!token) {
    throw new Error("Google Docs writeback requires auth, token_env, or token_command.");
  }

  const current = await googleDocsCurrentStatus(writeback, token);
  requireTransition(writeback, current.status, status);
  const requests = googleDocsStatusRequests(writeback, status);
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${writeback.document_id}:batchUpdate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requests,
        writeControl: current.revision_id ? { requiredRevisionId: current.revision_id } : undefined,
      }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("Google Docs writeback was not authorized. Use a token with Docs read/write scope.");
  }
  if (!response.ok) {
    throw new Error(`Google Docs writeback failed: HTTP ${response.status} ${await response.text()}`);
  }

  return { status, mode: status === "done" ? (writeback.mode ?? "mark_done") : "mark_status" };
}

async function googleDocsCurrentStatus(writeback, token) {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${writeback.document_id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Google Docs current-status check was not authorized.");
  }
  if (!response.ok) throw new Error(`Google Docs current-status check failed: HTTP ${response.status}`);
  const document = await response.json();
  const paragraph = (document.body?.content ?? []).find(
    (element) => Number(element.startIndex) === Number(writeback.paragraph_start),
  );
  if (!paragraph?.paragraph) {
    throw new Error("Google Docs task paragraph was not found during current-status check.");
  }
  const line = paragraphText(paragraph.paragraph).replace(/\n$/, "");
  return { status: todoLineStatus(line), revision_id: document.revisionId };
}

function paragraphText(paragraph) {
  return (paragraph.elements ?? []).map((element) => element.textRun?.content ?? "").join("");
}

export function googleDocsDoneRequests(writeback) {
  return googleDocsStatusRequests(writeback, "done");
}

export function googleDocsStatusRequests(writeback, status) {
  if (writeback.mode === "delete") {
    if (status !== "done") return googleDocsReplaceMarkerRequests(writeback, status);
    const startIndex = Number(writeback.paragraph_start);
    const endIndex = Math.max(startIndex, Number(writeback.paragraph_end) - 1);
    return [
      {
        deleteContentRange: {
          range: { startIndex, endIndex },
        },
      },
    ];
  }

  if (["mark_done", "mark-done", true, undefined].includes(writeback.mode)) {
    return googleDocsReplaceMarkerRequests(writeback, status);
  }

  throw new Error(`Unsupported Google Docs writeback mode: ${writeback.mode}`);
}

function googleDocsReplaceMarkerRequests(writeback, status) {
  const startIndex = Number(writeback.marker_start);
  const endIndex = Number(writeback.marker_end);
  const text =
    writeback.kind === "checkbox"
      ? { "in-progress": "[>]", blocked: "[!]", done: "[x]" }[status]
      : { "in-progress": "WIP ", blocked: "BLKD", done: "DONE" }[status];
  if (!text) throw new Error(`Unsupported Google Docs status: ${status}`);
  return [
    {
      deleteContentRange: {
        range: { startIndex, endIndex },
      },
    },
    {
      insertText: {
        location: { index: startIndex },
        text,
      },
    },
  ];
}

function notionToken(writeback) {
  const tokenEnv = writeback.token_env ?? "NOTION_TOKEN";
  if (tokenEnv && process.env[tokenEnv]) return process.env[tokenEnv].trim();

  if (writeback.token_command) {
    const result = spawnSync(writeback.token_command, { shell: true, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Notion token command failed.");
    }
    return result.stdout.trim();
  }

  throw new Error("Notion writeback requires token_env or token_command. Default token_env is NOTION_TOKEN.");
}

async function notionJson(method, url, token, writeback, body) {
  const headers = {
    authorization: `Bearer ${token}`,
    "notion-version": writeback.notion_version ?? "2022-06-28",
  };
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if ([401, 403, 404].includes(response.status)) {
    throw new Error(
      `Notion writeback was not authorized or the page was not shared with the integration: HTTP ${response.status} ${await response.text()}`,
    );
  }
  if (!response.ok) throw new Error(`Notion writeback failed: HTTP ${response.status} ${await response.text()}`);
  return await response.json();
}

async function markNotionStatus(writeback, status) {
  const token = notionToken(writeback);
  if (writeback.mode === "delete" && status === "done") {
    await notionJson("DELETE", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback);
    return { status: "done", mode: "delete" };
  }

  const block = await notionJson("GET", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback);
  if (block.type === "to_do") {
    const currentRaw = notionPlainText(block.to_do?.rich_text).trim();
    const currentStatus = block.to_do?.checked ? "done" : notionStatus(currentRaw);
    requireTransition(writeback, currentStatus, status);
    const current = stripNotionStatusPrefix(currentRaw);
    const payload =
      status === "done"
        ? { to_do: { checked: true, rich_text: notionRichText(current) } }
        : {
            to_do: {
              checked: false,
              rich_text: notionRichText(`${status === "blocked" ? "[!]" : "[>]"} ${current}`),
            },
          };
    await notionJson("PATCH", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback, {
      ...payload,
    });
    return { status, mode: writeback.mode ?? "mark_done" };
  }

  if (["paragraph", "bulleted_list_item", "numbered_list_item"].includes(block.type)) {
    const current = notionPlainText(block[block.type]?.rich_text);
    requireTransition(writeback, todoLineStatus(current.trim()), status);
    const replacement = current.match(/\[[ xX>!~-]\]/)
      ? current.replace(/\[[ xX>!~-]\]/, { "in-progress": "[>]", blocked: "[!]", done: "[x]" }[status])
      : current.replace(/\b(TODO|WIP|DONE|BLKD)\b/i, { "in-progress": "WIP ", blocked: "BLKD", done: "DONE" }[status]);
    await notionJson("PATCH", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback, {
      [block.type]: { rich_text: notionRichText(replacement) },
    });
    return { status, mode: writeback.mode ?? "mark_done" };
  }

  throw new Error(`Unsupported Notion block type for writeback: ${block.type}`);
}

function notionPlainText(richText) {
  return (richText ?? []).map((part) => part.plain_text ?? "").join("");
}

function stripNotionStatusPrefix(value) {
  return String(value ?? "").replace(/^\[[>!xX]\]\s+/, "");
}

function notionStatus(value) {
  if (value.startsWith("[>] ")) return "in-progress";
  if (value.startsWith("[!] ")) return "blocked";
  if (value.startsWith("[x] ") || value.startsWith("[X] ")) return "done";
  return "todo";
}

function notionRichText(content) {
  return [{ type: "text", text: { content } }];
}
