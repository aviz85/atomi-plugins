# עסק אטומי - פלאגינים ל-Codex Desktop

Marketplace מקומי עם פלאגינים שעוטפים סקילים קריטיים, להתקנה בלחיצה ב-Codex Desktop.

## פלאגינים

| פלאגין | מה הוא נותן | דרישה | סודות (scripts/.env) |
|--------|-------------|-------|----------------------|
| **whatsapp** | שליחה/קריאה של WhatsApp דרך Green API (כולל זיהוי תגובות ציטוט) | Node 18+ | `GREEN_API_URL`, `GREEN_API_INSTANCE`, `GREEN_API_TOKEN` |
| **morning** | הפקת חשבונית מס/קבלה דרך Morning (preview→issue) | Node 18+ | `MORNING_API_KEY`, `MORNING_API_SECRET` |
| **hitl** | שער אישור אנושי: תור משימות + בקשת אישור ב-WhatsApp + ביצוע לפי תגובת ציטוט | Node 18+ | משתף את פרטי Green API + `HITL_OWNER_PHONE` |

> כל הסקריפטים ב-**Node** (fetch מובנה, בלי תלויות להתקין). אם אין Node - מורידים מ-https://nodejs.org (LTS).

## התקנה

```bash
# 1. מוסיפים את ה-marketplace מ-GitHub (הריפו הציבורי של הפלאגינים)
codex plugin marketplace add aviz85/atomi-plugins
# מקומי (אם הורדתם את התיקייה):  codex plugin marketplace add /path/to/atomi-plugins

# 2. מתקינים את הפלאגינים
codex plugin add whatsapp@atomi
codex plugin add morning@atomi
codex plugin add hitl@atomi
```

ב-Codex Desktop הם יופיעו ברשימת הפלאגינים (מופעלים).

**הורדה ישירה (ZIP):** https://github.com/aviz85/atomi-plugins/archive/refs/heads/main.zip
**עמוד הקישורים:** https://start.atomi.biz/links

## הגדרת סודות

לכל פלאגין, צרו קובץ `scripts/.env` בתוך תיקיית הסקיל (`plugins/<name>/skills/<name>/scripts/.env`) לפי `.env.example` שלצידו, ומלאו את הפרטים שלכם. הקובץ הזה לא נשמר ב-git.

## שער אישור (HITL) - איך זה עובד

הלולאה המלאה של פלאגין ה-hitl:

1. פעולה דורשת אישור -> `hitl request "..." --action "..."` מכניס למסמך התור ושולח לכם הודעת WhatsApp. הפעולה לא מתבצעת עדיין.
2. אתם עונים ב-**תגובת ציטוט (Reply)**: `כן` / `לא` / `תקן: ...`.
3. אוטומציה מעירה את הסוכן כל כמה שעות -> `hitl poll` קורא את הצ'אט, מתאים כל תגובה למשימה הנכונה לפי מזהה ההודעה שצוטטה (`stanzaId`), ומחזיר את התשובה.
4. הסוכן מבצע (אישור/תיקון/חסימה) -> `hitl resolve` ומעדכן את המסמך.

ההתאמה בין תשובה למשימה מדויקת (לפי `stanzaId`), כך שכמה אישורים פתוחים לא מתבלבלים.

## בטיחות

- כל שליחה ל-WhatsApp למישהו שאינו אתם, וכל הפקת חשבונית - דורשות אישור (Human-in-the-Loop). Morning תמיד מציג preview לפני הנפקה אמיתית.
- אין סודות ב-git: כל `scripts/.env` ב-`.gitignore`. רק `.env.example` עם דוגמאות נשמר.

## מבנה (לכותבי פלאגינים)

```
codex-plugins/
├── .agents/plugins/marketplace.json     # מונה את הפלאגינים
└── plugins/<name>/
    ├── .codex-plugin/plugin.json        # מניפסט (skills / mcpServers + interface ל-UI)
    └── skills/<name>/
        ├── SKILL.md                     # frontmatter + הוראות
        └── scripts/                     # קוד Node (בלי תלויות) + .env.example
```
