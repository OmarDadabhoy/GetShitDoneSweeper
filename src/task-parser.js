import crypto from "node:crypto";

const checkboxRe = /^(?<indent>\s*)(?<bullet>[-*]\s+)\[(?<mark>[ xX>!~-])\]\s+(?<title>.+?)\s*$/;
const todoRe = /^(?<indent>\s*)(?:(?<bullet>[-*]\s+))?TODO[:\s]+(?<title>.+?)\s*$/i;
const statusRe = /^(?<indent>\s*)(?:(?<bullet>[-*]\s+))?(?<keyword>TODO|WIP|DONE|BLKD)[:\s]+(?<title>.+?)\s*$/i;

const checkboxStatus = {
  " ": "todo",
  ">": "in-progress",
  "!": "blocked",
  x: "done",
  X: "done",
};

const keywordStatus = {
  TODO: "todo",
  WIP: "in-progress",
  DONE: "done",
  BLKD: "blocked",
};

export function fingerprint(parts) {
  return crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 20);
}

export function parseTodoText(text, source) {
  const tasks = [];
  let inFence = false;
  const lines = String(text ?? "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const parsed = parseTodoLine(line);
    if (parsed?.actionable) tasks.push(makeTask(source, parsed.title, lineNumber));
  }

  return tasks;
}

export function parseTodoLine(line) {
  const checkbox = checkboxRe.exec(line);
  if (checkbox) {
    const markerOffset = line.indexOf(`[${checkbox.groups.mark}]`);
    const status = checkboxStatus[checkbox.groups.mark] ?? "unknown";
    return {
      actionable: status === "todo",
      kind: "checkbox",
      title: checkbox.groups.title.trim(),
      markerOffset,
      markerLength: 3,
      status,
    };
  }

  const todo = statusRe.exec(line) ?? todoRe.exec(line);
  if (!todo) return null;
  const keyword = (todo.groups.keyword ?? "TODO").toUpperCase();
  const status = keywordStatus[keyword] ?? "todo";
  const marker = /\b(TODO|WIP|DONE|BLKD)\b/i.exec(line);
  return {
    actionable: status === "todo",
    kind: "todo",
    title: todo.groups.title.trim(),
    markerOffset: marker?.index ?? 0,
    markerLength: marker?.[0]?.length ?? 4,
    status,
  };
}

export function todoLineStatus(line) {
  return parseTodoLine(line)?.status ?? "unknown";
}

export function updateTodoLineStatus(line, status) {
  const checkbox = checkboxRe.exec(line);
  if (checkbox) {
    const marker = { "in-progress": "[>]", blocked: "[!]", done: "[x]", todo: "[ ]" }[status];
    if (!marker) throw new Error(`Unsupported status: ${status}`);
    return line.replace(/\[[ xX>!~-]\]/, marker);
  }

  const parsed = statusRe.exec(line) ?? todoRe.exec(line);
  if (!parsed) return line;
  const marker = { "in-progress": "WIP ", blocked: "BLKD", done: "DONE", todo: "TODO" }[status];
  if (!marker) throw new Error(`Unsupported status: ${status}`);
  return line.replace(/\b(TODO|WIP|DONE|BLKD)\b/i, marker);
}

function makeTask(source, title, lineNumber) {
  const cleanTitle = title.trim();
  const location = `${source.location}:${lineNumber}`;
  const taskId = fingerprint([source.id, location, cleanTitle]);
  const task = {
    task_id: taskId,
    source_id: source.id,
    source_type: source.type,
    title: cleanTitle,
    body: "",
    location,
    source_ref: source.ref ?? source.location,
    created_from: "todo_text",
  };

  if (source.type === "text_file") {
    task.writeback = {
      type: "text_file",
      path: source.location,
      line: lineNumber,
    };
  }

  return task;
}
