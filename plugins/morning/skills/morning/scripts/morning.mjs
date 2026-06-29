#!/usr/bin/env node
// Morning (Green Invoice) - issue invoices safely. Node 18+ only (built-in fetch). No dependencies.
//   node morning.mjs invoice --amount 800 --desc "סדנה" --client "שם הלקוח" [--taxid 123] [--email a@b.com]   -> PREVIEW (default, no real doc)
//   node morning.mjs invoice ... --confirm                                                                     -> ISSUE a real חשבונית מס/קבלה
//   node morning.mjs token                                                                                     -> sanity check (auth only)
// Credentials: MORNING_API_KEY / MORNING_API_SECRET (from environment, or scripts/.env).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.greeninvoice.co.il/api/v1";
const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(HERE, ".env");
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const i = t.indexOf("="); const k = t.slice(0, i).trim();
      if (!env[k]) env[k] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
    }
  }
  for (const k of ["MORNING_API_KEY", "MORNING_API_SECRET"])
    if (!env[k]) { console.error(`missing ${k} (set in environment or scripts/.env)`); process.exit(1); }
  return env;
}

async function token(env) {
  const res = await fetch(`${BASE}/account/token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: env.MORNING_API_KEY, secret: env.MORNING_API_SECRET }),
  });
  const j = await res.json();
  if (!j.token) { console.error("auth failed:", JSON.stringify(j)); process.exit(1); }
  return j.token;
}

async function api(tok, method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function arg(f, d) { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; }
const has = (f) => process.argv.includes(f);

const cmd = process.argv[2];
const env = loadEnv();

if (cmd === "token") {
  await token(env); console.log("auth OK");
} else if (cmd === "invoice") {
  const amount = parseFloat(arg("--amount"));
  const desc = arg("--desc", "שירות");
  const client = arg("--client");
  const taxid = arg("--taxid");
  const email = arg("--email");
  if (!amount || !client) { console.error('need --amount and --client'); process.exit(1); }
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    type: 320, description: desc, lang: "he", currency: "ILS", vatType: 0, signed: true,
    client: { name: client, country: "IL", add: true, ...(taxid ? { taxId: taxid } : {}), ...(email ? { emails: [email] } : {}) },
    income: [{ description: desc, quantity: 1, price: amount, currency: "ILS", vatType: 1, vatRate: 0.18, vatIncluded: true }],
    payment: [{ date: today, type: 4, price: amount, currency: "ILS" }],
  };
  const tok = await token(env);
  if (!has("--confirm")) {
    const prev = await api(tok, "POST", "/documents/preview", payload);
    console.log("PREVIEW (no real document issued).");
    console.log("amount (incl VAT):", amount, "| client:", client, "| desc:", desc);
    if (prev.file || prev.url) console.log("preview file:", prev.file || prev.url);
    console.log("Review it, then re-run with --confirm to issue the real חשבונית מס/קבלה.");
  } else {
    const doc = await api(tok, "POST", "/documents", payload);
    console.log("ISSUED:", JSON.stringify({ id: doc.id, number: doc.number, url: doc.url || doc.urls?.he?.original }));
  }
} else {
  console.error('usage: node morning.mjs invoice --amount N --client "שם" [--desc ..] [--taxid ..] [--email ..] [--confirm]  |  token');
  process.exit(1);
}
