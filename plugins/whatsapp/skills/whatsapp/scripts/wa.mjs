#!/usr/bin/env node
// WhatsApp via Green API - send / read. Node 18+ only (built-in fetch). No dependencies.
//   node wa.mjs send --to 972501234567 "message"
//   node wa.mjs send --group 12036300000@g.us "message"
//   node wa.mjs read --count 10
// Credentials: GREEN_API_URL / GREEN_API_INSTANCE / GREEN_API_TOKEN
// (from environment, or from a .env file next to this script).
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

function arg(flag) { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : undefined; }

// Send a local file (PDF / image / any document) with optional caption, via Green API sendFileByUpload.
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

const cmd = process.argv[2];
const env = loadEnv();

if (cmd === "send") {
  const to = arg("--to"), group = arg("--group");
  const file = arg("--file");
  const caption = arg("--caption");
  if (!to && !group) { console.error("need --to or --group"); process.exit(1); }
  const chatId = group || normalize(to);
  if (file) {
    if (!fs.existsSync(file)) { console.error("file not found:", file); process.exit(1); }
    const r = await sendFile(env, chatId, file, caption);
    console.log("sent file:", r.idMessage || JSON.stringify(r));
  } else {
    const message = process.argv[process.argv.length - 1];
    const r = await call(env, "sendMessage", { chatId, message });
    console.log("sent:", r.idMessage || JSON.stringify(r));
  }
} else if (cmd === "read") {
  const count = parseInt(arg("--count") || "10", 10);
  const r = await call(env, "lastIncomingMessages", undefined);
  const msgs = Array.isArray(r) ? r : [];
  for (const m of msgs.slice(0, count)) {
    const who = m.senderName || m.chatId || "?";
    const txt = m.textMessage || m.extendedTextMessage?.text || "[media]";
    // If this message is a quote-reply, show what it replied to + the quoted message id (stanzaId).
    if (m.typeMessage === "quotedMessage" || m.quotedMessage) {
      const stanza = m.extendedTextMessage?.stanzaId || m.quotedMessage?.stanzaId || "?";
      const quoted = m.quotedMessage?.textMessage || m.quotedMessage?.extendedTextMessage?.text || "";
      const q = quoted ? ` ⟶ בתגובה ל: "${quoted.slice(0, 80)}"` : "";
      console.log(`- ${who} [reply id=${m.idMessage} →quoted=${stanza}]: ${txt}${q}`);
    } else {
      console.log(`- ${who} [id=${m.idMessage}]: ${txt}`);
    }
  }
} else {
  console.error("usage: node wa.mjs send --to <num>|--group <id> \"msg\"  |  read --count N");
  process.exit(1);
}
