import crypto from "node:crypto";

const checkboxRe = /^(?<indent>\s*)(?<bullet>[-*]\s+)\[(?<mark>[ xX>!~-])\]\s+(?<title>.+?)\s*$/;
const todoRe = /^(?<indent>\s*)(?:(?<bullet>[-*]\s+))?TODO[:\s]+(?<title>.+?)\s*$/i;

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
    const markerOffset = line.indexOf("[ ]");
    return {
      actionable: checkbox.groups.mark === " ",
      kind: "checkbox",
      title: checkbox.groups.title.trim(),
      markerOffset,
      markerLength: 3,
    };
  }

  const todo = todoRe.exec(line);
  if (!todo) return null;
  const marker = /TODO/i.exec(line);
  return {
    actionable: true,
    kind: "todo",
    title: todo.groups.title.trim(),
    markerOffset: marker?.index ?? 0,
    markerLength: 4,
  };
}

function makeTask(source, title, lineNumber) {
  const cleanTitle = title.trim();
  const location = `${source.location}:${lineNumber}`;
  const taskId = fingerprint([source.id, location, cleanTitle]);

  return {
    task_id: taskId,
    source_id: source.id,
    source_type: source.type,
    title: cleanTitle,
    body: "",
    location,
    source_ref: source.ref ?? source.location,
    created_from: "todo_text",
  };
}
