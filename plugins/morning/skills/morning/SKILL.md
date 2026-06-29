---
name: morning
description: Issue invoices (חשבונית מס/קבלה) via Morning (Green Invoice). Use when the user wants to create an invoice or receipt. ALWAYS preview before issuing a real document.
version: "1.0.0"
author: aviz85
tags: [morning, green-invoice, invoice, חשבונית]
allowed-tools: Bash, Read
---

# Morning (Green Invoice) - Invoices

Issue a חשבונית מס/קבלה (type 320) through Morning, with a mandatory preview-before-issue gate.

## Requirement

**Node.js 18 or newer** (uses built-in `fetch`, no packages). Check with `node --version`. Install from https://nodejs.org (LTS) if missing.

## Setup (once)

Create `scripts/.env` with your Morning API credentials (Morning → Settings → Developer / API):

```
MORNING_API_KEY=your_api_key
MORNING_API_SECRET=your_api_secret
```

The key must have document/clearing permissions. Sanity check: `node scripts/morning.mjs token` → `auth OK`.

## Issue an invoice - the safe two-step flow

**Step 1 - Preview (no real document):**
```bash
node scripts/morning.mjs invoice --amount 800 --desc "סדנת עסק אטומי" --client "שם הלקוח" --email client@example.com
```
This calls the preview endpoint and prints what will be issued. **Show it to the user.**

**Step 2 - Issue (real document) only after the user approves:**
```bash
node scripts/morning.mjs invoice --amount 800 --desc "סדנת עסק אטומי" --client "שם הלקוח" --email client@example.com --confirm
```
Returns the document id, number, and URL.

## Rules (iron law)

- **Never issue without a preview first**, and never without explicit user approval. A wrong invoice is painful to cancel.
- VAT is included in the price (`vatIncluded`), at 18% (`vatRate: 0.18`). Adjust in the script if the rate changes.
- The amount you pass is the gross (VAT-inclusive) total.
