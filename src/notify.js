import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import tls from "node:tls";
import { spawnSync } from "node:child_process";

export async function sendNotification({ root, event, task, body }) {
  const configPath = path.join(root, "config", "notifications.json");
  if (!fs.existsSync(configPath)) return { status: "disabled" };
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const configuredTo = Array.isArray(config.to) ? config.to : [config.to].filter(Boolean);
  const envTo = ["GSD_EMAIL_TO", "TODO_SKILL_EMAIL_TO", "NOTIFY_EMAIL_TO", "USER_EMAIL", "EMAIL"].flatMap((name) =>
    process.env[name] ? process.env[name].split(",") : [],
  );
  const to = [...configuredTo, ...envTo].map((value) => String(value ?? "").trim()).filter(Boolean);
  const realTo = to.filter((value) => value.toLowerCase() !== "you@example.com");
  if (!config.enabled && realTo.length === 0) return { status: "disabled" };
  if (realTo.length === 0) throw new Error("Notification config needs at least one recipient in 'to'.");

  const subject = `${config.subject_prefix ?? "[Get Shit Done]"} ${
    event === "done" ? `Task completed: ${task}` : `Input needed: ${task}`
  }`;
  const message = [`Event: ${event}`, `Task: ${task}`, "", body || "(no details provided)", ""].join("\n");

  if ((config.method ?? "command") === "command") {
    if (!config.command) config.command = "mail -s {subject} {to} < {body_file}";
    sendCommand(config, subject, message, realTo);
  } else if (config.method === "smtp") {
    await sendSmtp(config, subject, message, realTo);
  } else {
    throw new Error(`Unsupported notification method: ${config.method}`);
  }

  return { status: "sent", event, to: realTo };
}

function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function sendCommand(config, subject, body, to) {
  if (!config.command) throw new Error("Notification method 'command' requires command.");
  const bodyFile = path.join(os.tmpdir(), `gsd-notify-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(bodyFile, body);
  try {
    const command = config.command
      .replaceAll("{subject}", quote(subject))
      .replaceAll("{body}", quote(body))
      .replaceAll("{body_file}", quote(bodyFile))
      .replaceAll("{to}", quote(to.join(",")));
    const result = spawnSync(command, { shell: true, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Notification command failed.");
    }
  } finally {
    fs.rmSync(bodyFile, { force: true });
  }
}

async function sendSmtp(config, subject, body, to) {
  const smtp = config.smtp ?? {};
  if (!smtp.host) throw new Error("SMTP notification requires smtp.host.");
  const username = process.env[smtp.username_env] ?? smtp.username ?? "";
  const password = process.env[smtp.password_env] ?? smtp.password ?? "";
  const from = smtp.from ?? config.from ?? username;
  if (!from) throw new Error("SMTP notification requires smtp.from or username.");

  const port = Number(smtp.port ?? 587);
  const socket = await connectSmtp(smtp.host, port, smtp.starttls !== false);
  try {
    await expect(socket, "220");
    await command(socket, `EHLO localhost\r\n`, "250");
    if (smtp.starttls !== false) {
      await command(socket, "STARTTLS\r\n", "220");
      const secure = tls.connect({ socket, servername: smtp.host });
      await command(secure, `EHLO localhost\r\n`, "250");
      if (username || password) await smtpLogin(secure, username, password);
      await sendMailData(secure, from, to, subject, body);
      secure.end("QUIT\r\n");
      return;
    }
    if (username || password) await smtpLogin(socket, username, password);
    await sendMailData(socket, from, to, subject, body);
    socket.end("QUIT\r\n");
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function connectSmtp(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.setEncoding("utf8");
    socket.setTimeout(30000, () => reject(new Error("SMTP connection timed out.")));
    socket.on("error", reject);
  });
}

function expect(socket, code) {
  return new Promise((resolve, reject) => {
    socket.once("data", (chunk) => {
      String(chunk).startsWith(code) ? resolve(chunk) : reject(new Error(`SMTP expected ${code}, got ${chunk}`));
    });
  });
}

async function command(socket, text, code) {
  socket.write(text);
  return await expect(socket, code);
}

async function smtpLogin(socket, username, password) {
  await command(socket, "AUTH LOGIN\r\n", "334");
  await command(socket, `${Buffer.from(username).toString("base64")}\r\n`, "334");
  await command(socket, `${Buffer.from(password).toString("base64")}\r\n`, "235");
}

async function sendMailData(socket, from, to, subject, body) {
  await command(socket, `MAIL FROM:<${from}>\r\n`, "250");
  for (const recipient of to) await command(socket, `RCPT TO:<${recipient}>\r\n`, "250");
  await command(socket, "DATA\r\n", "354");
  const message = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.replaceAll("\n.", "\n.."),
    ".",
    "",
  ].join("\r\n");
  await command(socket, message, "250");
}
