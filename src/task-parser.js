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

    const checkbox = checkboxRe.exec(line);
    if (checkbox) {
      if (checkbox.groups.mark === " ") {
        tasks.push(makeTask(source, checkbox.groups.title, lineNumber));
      }
      continue;
    }

    const todo = todoRe.exec(line);
    if (todo) {
      tasks.push(makeTask(source, todo.groups.title, lineNumber));
    }
  }

  return tasks;
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
