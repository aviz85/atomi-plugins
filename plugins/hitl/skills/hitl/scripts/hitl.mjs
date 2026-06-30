#!/usr/bin/env node
// HITL - Human-in-the-Loop approval queue, via WhatsApp (Green API). Node 18+ only (built-in fetch). No dependencies.
//
// Flow:
//   1) request  - a task needs approval: queue it + send an approval message on WhatsApp to the owner (self).
//   2) poll      - read the owner's chat, find quote-replies to our approval messages, attach the reply to the task.
//   3) resolve   - record the decision (approved | corrected | blocked) after the agent acted.
//
// Commands:
//   node hitl.mjs request "<title>" --action "<what to do once approved>" [--to <phone>] [--queue <path>]
//   node hitl.mjs poll [--queue <path>]
//   node hitl.mjs resolve <id> --decision approved|corrected|blocked [--note "..."] [--queue <path>]
//   node hitl.mjs remind [--hours N] [--queue <path>]
//   node hitl.mjs list [--status <s>] [--queue <path>]
//
// Credentials / config (environment or scripts/.env next to this file):
//   GREEN_API_URL, GREEN_API_INSTANCE, GREEN_API_TOKEN   - Green API instance
//   HITL_OWNER_PHONE                                     - the owner's own WhatsApp number (messages to self)
//   HITL_QUEUE (optional)                                - path to the queue file (default ./hitl-queue.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(HERE, ".env");
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (t && !t.startsWith("#") && t.includes("=")) {
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        if (!env[k]) env[k] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
      }
    }
  }
  for (const k of ["GREEN_API_URL", "GREEN_API_INSTANCE", "GREEN_API_TOKEN"]) {
    if (!env[k]) { console.error(`missing ${k} (set in environment or scripts/.env)`); process.exit(1); }
  }
  return env;
}

function normalize(phone) {
  let d = (phone || "").replace(/[^0-9]/g, "");
  if (d.startsWith("972")) {} else if (d.startsWith("0")) d = "972" + d.slice(1); else d = "972" + d;
  return d + "@c.us";
}

async function call(env, method, payload) {
  const url = `${env.GREEN_API_URL}/waInstance${env.GREEN_API_INSTANCE}/${method}/${env.GREEN_API_TOKEN}`;
  const res = await fetch(url, payload === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return res.json();
}

// Send a local file (PDF / image / any document) with an optional caption, via Green API sendFileByUpload.
async function sendFile(env, chatId, filePath, caption) {
  const url = `${env.GREEN_API_URL}/waInstance${env.GREEN_API_INSTANCE}/sendFileByUpload/${env.GREEN_API_TOKEN}`;
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("chatId", chatId);
  if (caption) fd.append("caption", caption);
  fd.append("file", new Blob([buf]), path.basename(filePath));
  const res = await fetch(url, { method: "POST", body: fd });
  return res.json();
}

// Copy an attachment into durable storage next to the queue (inside the Second Brain): hitl-files/<id>-<name>.
function storeFile(qp, id, src) {
  const dir = path.join(path.dirname(qp), "hitl-files");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${id}-${path.basename(src)}`);
  fs.copyFileSync(src, dest);
  return dest;
}

function arg(flag) { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : undefined; }

function queuePath(env) {
  return arg("--queue") || env.HITL_QUEUE || path.join(process.cwd(), "hitl-queue.json");
}
function readQueue(qp) {
  if (!fs.existsSync(qp)) return { tasks: [] };
  try { return JSON.parse(fs.readFileSync(qp, "utf8")); } catch { return { tasks: [] }; }
}
function writeQueue(qp, q) { fs.writeFileSync(qp, JSON.stringify(q, null, 2) + "\n"); }
function nextId(q) {
  let max = 0;
  for (const t of q.tasks) { const n = parseInt(String(t.id).replace(/\D/g, ""), 10); if (n > max) max = n; }
  return "T" + (max + 1);
}
function nowISO() { return new Date().toISOString(); }

function approvalMessage(id, title) {
  return [
    `בקשת אישור · משימה ${id}`,
    ``,
    title,
    ``,
    `כדי לענות, עשו Reply (ציטוט) להודעה הזו:`,
    `כן = לאשר ולבצע`,
    `לא = לחסום`,
    `תקן: ... = לתקן ואז לבצע`,
  ].join("\n");
}

const cmd = process.argv[2];
const env = loadEnv();
const qp = queuePath(env);

if (cmd === "request") {
  const title = process.argv[3];
  if (!title || title.startsWith("--")) { console.error('usage: request "<title>" --action "<action>" [--to <phone>]'); process.exit(1); }
  const action = arg("--action") || title;
  const file = arg("--file");
  const to = normalize(arg("--to") || env.HITL_OWNER_PHONE);
  if (!to || to === "@c.us") { console.error("missing owner phone: pass --to or set HITL_OWNER_PHONE"); process.exit(1); }
  const q = readQueue(qp);
  const id = nextId(q);
  // If an attachment is given (e.g. an invoice PDF preview), store it in the brain and send it as the approval message.
  let storedFile = null, r;
  if (file) {
    if (!fs.existsSync(file)) { console.error("file not found:", file); process.exit(1); }
    storedFile = storeFile(qp, id, file);
    r = await sendFile(env, to, storedFile, approvalMessage(id, title));
  } else {
    r = await call(env, "sendMessage", { chatId: to, message: approvalMessage(id, title) });
  }
  if (!r.idMessage) { console.error("send failed:", JSON.stringify(r)); process.exit(1); }
  q.tasks.push({
    id, created: nowISO(), updated: nowISO(),
    title, action,
    status: "awaiting_reply",
    chat: to,
    approval_msg_ids: [r.idMessage],
    file: storedFile,
    reply_text: null, reply_msg_id: null,
    decision: null, note: null,
  });
  writeQueue(qp, q);
  console.log(JSON.stringify({ ok: true, id, approval_msg_id: r.idMessage, chat: to, file: storedFile, queue: qp }, null, 2));

} else if (cmd === "poll") {
  const q = readQueue(qp);
  const awaiting = q.tasks.filter(t => t.status === "awaiting_reply");
  const chats = [...new Set(awaiting.map(t => t.chat))];
  const replied = [];
  for (const chat of chats) {
    const h = await call(env, "getChatHistory", { chatId: chat, count: 100 });
    const msgs = Array.isArray(h) ? h : [];
    for (const m of msgs) {
      if (m.typeMessage !== "quotedMessage") continue;
      const stanza = m.extendedTextMessage?.stanzaId || m.quotedMessage?.stanzaId;
      const text = m.extendedTextMessage?.text || m.textMessage || "";
      if (!stanza) continue;
      const task = awaiting.find(t => t.status === "awaiting_reply" && (t.approval_msg_ids || []).includes(stanza));
      if (task) {
        task.status = "replied";
        task.reply_text = text;
        task.reply_msg_id = m.idMessage;
        task.updated = nowISO();
        replied.push({ id: task.id, title: task.title, action: task.action, reply_text: text });
      }
    }
  }
  writeQueue(qp, q);
  console.log(JSON.stringify({ ok: true, replied_count: replied.length, replied, queue: qp }, null, 2));

} else if (cmd === "resolve") {
  const id = process.argv[3];
  const decision = arg("--decision");
  const note = arg("--note") || null;
  if (!id || !["approved", "corrected", "blocked"].includes(decision)) {
    console.error('usage: resolve <id> --decision approved|corrected|blocked [--note "..."]'); process.exit(1);
  }
  const q = readQueue(qp);
  const task = q.tasks.find(t => t.id === id);
  if (!task) { console.error("no such task:", id); process.exit(1); }
  task.decision = decision;
  task.status = decision; // approved | corrected | blocked (terminal)
  task.note = note;
  task.updated = nowISO();
  writeQueue(qp, q);
  console.log(JSON.stringify({ ok: true, id, status: task.status, note }, null, 2));

} else if (cmd === "remind") {
  const hours = parseFloat(arg("--hours") || "3");
  const cutoff = Date.now() - hours * 3600 * 1000;
  const q = readQueue(qp);
  let sent = 0;
  for (const task of q.tasks) {
    if (task.status !== "awaiting_reply") continue;
    if (new Date(task.updated).getTime() > cutoff) continue;
    const r = (task.file && fs.existsSync(task.file))
      ? await sendFile(env, task.chat, task.file, approvalMessage(task.id, task.title))
      : await call(env, "sendMessage", { chatId: task.chat, message: approvalMessage(task.id, task.title) });
    if (r.idMessage) {
      (task.approval_msg_ids = task.approval_msg_ids || []).push(r.idMessage);
      task.updated = nowISO();
      sent++;
    }
  }
  writeQueue(qp, q);
  console.log(JSON.stringify({ ok: true, reminded: sent, queue: qp }, null, 2));

} else if (cmd === "list") {
  const status = arg("--status");
  const q = readQueue(qp);
  const tasks = status ? q.tasks.filter(t => t.status === status) : q.tasks;
  console.log(JSON.stringify({ count: tasks.length, tasks, queue: qp }, null, 2));

} else {
  console.error('usage: hitl.mjs request "<title>" --action "<a>" | poll | resolve <id> --decision <d> | remind [--hours N] | list [--status s]');
  process.exit(1);
}
