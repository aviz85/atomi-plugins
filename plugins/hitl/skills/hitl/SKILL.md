---
name: hitl
description: Human-in-the-Loop approval gate. Use whenever an action needs the owner's approval before it runs - sending money, issuing an invoice, publishing a post, messaging a client, deleting data, or anything irreversible. Queues the task, asks the owner on WhatsApp, and on each wake reads the owner's quote-reply and acts on it.
version: "1.0.0"
author: aviz85
tags: [hitl, approval, human-in-the-loop, whatsapp, queue, automation]
allowed-tools: Bash, Read, Write
---

# HITL - Human-in-the-Loop

A worker that holds a **task queue document** and runs every action that needs a human decision through the owner, over WhatsApp. The owner approves, corrects, or blocks by **quote-replying** (Reply) to the message.

## Requirement

**Node.js 18+** (built-in `fetch`, no packages). Shares the same Green API instance as the WhatsApp plugin.

## Setup (once)

Create `scripts/.env` next to the script (see `.env.example`):

```
GREEN_API_URL=https://XXXX.api.greenapi.com
GREEN_API_INSTANCE=1234567890
GREEN_API_TOKEN=your_token_here
HITL_OWNER_PHONE=972501234567        # the owner's own number (messages to self)
# HITL_QUEUE=/.../Second Brain/08-hitl/hitl-queue.json   # optional, recommended inside the brain
```

The **queue document** is a JSON file (`hitl-queue.json`). Keep it inside the Second Brain so it is part of the business memory.

## How it works (the full loop)

1. **A task needs approval.** Another worker (or you) reaches a step that must not run without a human OK. Instead of doing it, you call HITL to **queue** the task and **notify** the owner. Then you stop.
2. **The owner gets a WhatsApp message** describing the task, and replies by **quoting** that message (Reply): `כן` / `לא` / `תקן: ...`.
3. **Every few hours an automation wakes HITL.** It **polls** the owner's chat, matches each quote-reply to the right task (by the quoted message id - exact, never confused between tasks), and hands you the reply.
4. **You act on the reply** (approve / correct / block), then **resolve** the task and update the brain.

### Matching is exact

When you send an approval message you store its message id. A quote-reply carries `stanzaId` = the id of the quoted message. HITL matches `stanzaId` back to the task, so several pending approvals never get mixed up.

## A) When a task needs approval

```bash
node scripts/hitl.mjs request "לאשר שליחת חשבונית 1,000 ש\"ח ללקוח דני" \
  --action "הפק חשבונית מס/קבלה לדני על 1000 ש\"ח ושלח לו"
```

This queues the task (`status: awaiting_reply`), sends the owner a WhatsApp approval message, and stores its id. **Do not perform the action now** - it waits for approval. Optional `--to <phone>` overrides the owner number.

## B) On wake (the automation runs this)

```bash
node scripts/hitl.mjs poll
```

`poll` returns the tasks that got a reply, each with its `reply_text`. For each one, **read the reply and decide**:

- **Approval** (`כן`, `מאשר`, `אישור`, `👍`, `אוקיי`) -> perform the task's `action`, then:
  `node scripts/hitl.mjs resolve <id> --decision approved`
- **Correction** (`תקן: ...`, `שנה ל...`, `במקום X תעשה Y`) -> apply the correction to the action, perform it, then:
  `node scripts/hitl.mjs resolve <id> --decision corrected --note "מה שונה"`
- **Block** (`לא`, `עצור`, `אל תשלח`, `חסום`) -> do **not** perform; just:
  `node scripts/hitl.mjs resolve <id> --decision blocked`
- **Ambiguous** -> leave it (it stays `replied`); send the owner a short clarifying question and pick it up next wake.

After resolving, append a human-readable line to the brain's log (e.g. `08-hitl/log.md`): what was asked, what was decided, what you did.

## Reminders

Tasks still waiting can be nudged:

```bash
node scripts/hitl.mjs remind --hours 3   # re-send approvals untouched for 3h+
```

A reminder adds a second message id to the task, so a quote-reply to either the original or the reminder still matches.

## Inspect the queue

```bash
node scripts/hitl.mjs list                 # everything
node scripts/hitl.mjs list --status awaiting_reply
```

Statuses: `awaiting_reply` -> `replied` -> `approved` | `corrected` | `blocked`.

## The wake automation

HITL only acts when something runs `poll`. Set up a Codex Automation that wakes it every few hours. Easiest - tell Codex:

> בנה אוטומציה בשם "HITL - בדיקת אישורים" שרצה כל 3 שעות, workspace = תיקיית הפרויקט, ומריצה את הפרומפט: "התעורר כסוכן ה-HITL. הרץ node scripts/hitl.mjs poll. לכל משימה שחזרה תשובה - פרש (אישור/תיקון/חסימה), בצע בהתאם, ואז hitl resolve, ועדכן את הלוג במוח."

A ready template is in `references/automation.toml`.

## Rules

- Never perform an approval-gated action before the owner approved it via a quote-reply.
- A correction means: change the action as instructed, then treat it as approved.
- Keep WhatsApp text natural Hebrew, no markdown, no em-dash (use a plain hyphen).
- The queue document is the source of truth - always update it through the script, never hand-edit mid-flow.
