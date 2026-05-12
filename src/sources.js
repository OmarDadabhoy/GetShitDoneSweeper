import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseTodoText, fingerprint } from "./task-parser.js";

const googleDocIdRe = /\/document\/d\/([a-zA-Z0-9_-]+)/;

export async function collectTasks(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const tasks = [];

  for (const source of sources) {
    if (source.enabled === false) continue;
    if (!source.id) throw new Error("Every source needs an id.");

    if (source.type === "text_file") {
      tasks.push(...readTextFileSource(source, configPath));
    } else if (source.type === "google_docs") {
      tasks.push(...(await readGoogleDocsSource(source)));
    } else if (source.type === "github_issues") {
      tasks.push(...readGitHubIssuesSource(source));
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  return tasks;
}

function resolveConfigPath(configPath, value) {
  const expanded = String(value).replace(/^~(?=$|\/)/, process.env.HOME ?? "~");
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(path.dirname(configPath), expanded);
}

function readTextFileSource(source, configPath) {
  const file = resolveConfigPath(configPath, source.path);
  if (!fs.existsSync(file)) return [];
  return parseTodoText(fs.readFileSync(file, "utf8"), {
    id: source.id,
    type: source.type,
    location: file,
    ref: file,
  });
}

function googleDocId(source) {
  if (source.document_id) return String(source.document_id);
  const match = googleDocIdRe.exec(String(source.url ?? ""));
  if (!match) throw new Error(`Google Docs source ${source.id} needs document_id or a valid url.`);
  return match[1];
}

function googleDocsExportUrl(source) {
  if (source.export_url) return String(source.export_url);
  return `https://docs.google.com/document/d/${googleDocId(source)}/export?format=txt`;
}

function googleBearerToken(source) {
  if (source.token_env && process.env[source.token_env]) {
    return process.env[source.token_env].trim();
  }

  if (source.token_command) {
    const result = spawnSync(source.token_command, { shell: true, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Token command failed for ${source.id}.`);
    }
    return result.stdout.trim();
  }

  if (source.auth === "gcloud") {
    const result = spawnSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `gcloud auth failed for ${source.id}.`);
    }
    return result.stdout.trim();
  }

  return "";
}

async function readGoogleDocsSource(source) {
  const headers = {};
  const token = googleBearerToken(source);
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(googleDocsExportUrl(source), { headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Google Docs source ${source.id} is not readable. Make it public/published or configure auth.`,
    );
  }
  if (!response.ok) throw new Error(`Google Docs source ${source.id} failed: HTTP ${response.status}`);

  const text = await response.text();
  const location = source.url ?? source.export_url ?? `Google Docs:${googleDocId(source)}`;
  return parseTodoText(text, {
    id: source.id,
    type: source.type,
    location,
    ref: location,
  });
}

function readGitHubIssuesSource(source) {
  if (!source.repo) throw new Error(`GitHub source ${source.id} needs repo.`);

  const fields = "number,title,url,body,labels,updatedAt";
  const args = [
    "issue",
    "list",
    "--repo",
    source.repo,
    "--state",
    source.state ?? "open",
    "--limit",
    String(source.limit ?? 20),
    "--json",
    fields,
  ];
  if (source.label) args.splice(6, 0, "--label", source.label);

  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `gh issue list failed for ${source.id}.`);
  }

  const issues = JSON.parse(result.stdout);
  return issues.map((issue) => ({
    task_id: fingerprint([source.id, source.repo, String(issue.number), issue.updatedAt ?? ""]),
    source_id: source.id,
    source_type: source.type,
    title: issue.title,
    body: issue.body ?? "",
    location: `${source.repo}#${issue.number}`,
    source_ref: issue.url,
    github: {
      repo: source.repo,
      number: issue.number,
      url: issue.url,
      labels: (issue.labels ?? []).map((label) => label.name),
    },
    created_from: "github_issue",
  }));
}
