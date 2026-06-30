---
name: whatsapp
description: Send and read WhatsApp messages via the Green API. Use when the user wants to send a WhatsApp message, a reminder, a notification, or to read recent incoming WhatsApp messages.
version: "1.0.0"
author: aviz85
tags: [whatsapp, green-api, messaging]
allowed-tools: Bash, Read
---

# WhatsApp (Green API)

Send and read WhatsApp from Codex through the [Green API](https://green-api.com).

## Requirement

**Node.js 18 or newer** (uses the built-in `fetch`, no packages to install). Check with `node --version`. If missing, install from https://nodejs.org (LTS).

## Setup (once)

Create a `.env` file next to the script (`scripts/.env`) with your Green API credentials:

```
GREEN_API_URL=https://XXXX.api.greenapi.com
GREEN_API_INSTANCE=1234567890
GREEN_API_TOKEN=your_token_here
```

Get these from your Green API console (Instance ID + API token). The script also reads the same vars from the environment if set.

## Send a message

```bash
node scripts/wa.mjs send --to 972501234567 "ההודעה כאן"
# group:
node scripts/wa.mjs send --group 1203630000000000@g.us "הודעה לקבוצה"
```

- `--to` accepts Israeli formats (`0501234567`, `972501234567`) and is normalized.
- Returns the Green API `idMessage` on success.

## Read recent incoming messages

```bash
node scripts/wa.mjs read --count 10
```

Each line shows the message id. If a message is a **quote-reply** (the user used Reply), it also shows the quoted message id (`stanzaId`) and a snippet of what it replied to:

```
- אביץ [reply id=3EB0... →quoted=3EB0AA...]: כן מאשר ⟶ בתגובה ל: "בקשת אישור · משימה T1 ..."
```

So you can tell which message an answer is replying to. This is how approvals are matched to requests (see the HITL plugin, which automates it).

## Rules

- Hebrew messages: keep it natural, no markdown. Start lines with a Hebrew letter where possible (a leading digit/dash/emoji can break RTL).
- Never use an em-dash (—); use a plain hyphen.
- Sending to anyone other than the user is sensitive: show the draft and get approval first (Human-in-the-Loop).
