import { spawnSync } from "node:child_process";

export async function markTaskDone(task) {
  if (!task.writeback) return { status: "skipped", reason: "task has no writeback metadata" };
  if (task.writeback.type === "google_docs") return await markGoogleDocsDone(task.writeback);
  if (task.writeback.type === "notion_page") return await markNotionDone(task.writeback);
  return { status: "skipped", reason: `unsupported writeback type: ${task.writeback.type}` };
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

async function markGoogleDocsDone(writeback) {
  const token = googleBearerToken(writeback);
  if (!token) {
    throw new Error("Google Docs writeback requires auth, token_env, or token_command.");
  }

  const requests = googleDocsDoneRequests(writeback);
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${writeback.document_id}:batchUpdate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requests }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("Google Docs writeback was not authorized. Use a token with Docs read/write scope.");
  }
  if (!response.ok) {
    throw new Error(`Google Docs writeback failed: HTTP ${response.status} ${await response.text()}`);
  }

  return { status: "done", mode: writeback.mode ?? "mark_done" };
}

export function googleDocsDoneRequests(writeback) {
  if (writeback.mode === "delete") {
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
    const startIndex = Number(writeback.marker_start);
    const endIndex = Number(writeback.marker_end);
    const text = writeback.kind === "checkbox" ? "[x]" : "DONE";
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

  throw new Error(`Unsupported Google Docs writeback mode: ${writeback.mode}`);
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

async function markNotionDone(writeback) {
  const token = notionToken(writeback);
  if (writeback.mode === "delete") {
    await notionJson("DELETE", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback);
    return { status: "done", mode: "delete" };
  }

  const block = await notionJson("GET", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback);
  if (block.type === "to_do") {
    await notionJson("PATCH", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback, {
      to_do: { checked: true },
    });
    return { status: "done", mode: writeback.mode ?? "mark_done" };
  }

  if (["paragraph", "bulleted_list_item", "numbered_list_item"].includes(block.type)) {
    const current = notionPlainText(block[block.type]?.rich_text);
    const replacement = current.includes("[ ]")
      ? current.replace("[ ]", "[x]")
      : current.replace(/\bTODO\b/i, "DONE");
    await notionJson("PATCH", `https://api.notion.com/v1/blocks/${writeback.block_id}`, token, writeback, {
      [block.type]: { rich_text: notionRichText(replacement) },
    });
    return { status: "done", mode: writeback.mode ?? "mark_done" };
  }

  throw new Error(`Unsupported Notion block type for writeback: ${block.type}`);
}

function notionPlainText(richText) {
  return (richText ?? []).map((part) => part.plain_text ?? "").join("");
}

function notionRichText(content) {
  return [{ type: "text", text: { content } }];
}
