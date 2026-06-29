# עסק אטומי - פלאגינים ל-Codex Desktop

Marketplace מקומי עם פלאגינים שעוטפים סקילים קריטיים, להתקנה בלחיצה ב-Codex Desktop.

## פלאגינים

| פלאגין | מה הוא נותן | דרישה | סודות (scripts/.env) |
|--------|-------------|-------|----------------------|
| **whatsapp** | שליחה/קריאה של WhatsApp דרך Green API | Node 18+ | `GREEN_API_URL`, `GREEN_API_INSTANCE`, `GREEN_API_TOKEN` |
| **morning** | הפקת חשבונית מס/קבלה דרך Morning (preview→issue) | Node 18+ | `MORNING_API_KEY`, `MORNING_API_SECRET` |

> כל הסקריפטים ב-**Node** (fetch מובנה, בלי תלויות להתקין). אם אין Node - מורידים מ-https://nodejs.org (LTS).

## התקנה

```bash
# 1. מוסיפים את ה-marketplace (נתיב מקומי או git)
codex plugin marketplace add /path/to/codex-plugins
# או מ-git:  codex plugin marketplace add https://github.com/aviz85/atomic-biz.git

# 2. מתקינים את הפלאגינים
codex plugin add whatsapp@atomi
codex plugin add morning@atomi
```

ב-Codex Desktop הם יופיעו ברשימת הפלאגינים (מופעלים).

## הגדרת סודות

לכל פלאגין, צרו קובץ `scripts/.env` בתוך תיקיית הסקיל (`plugins/<name>/skills/<name>/scripts/.env`) לפי `.env.example` שלצידו, ומלאו את הפרטים שלכם. הקובץ הזה לא נשמר ב-git.

## בטיחות

- כל שליחה ל-WhatsApp למישהו שאינו אתם, וכל הפקת חשבונית - דורשות אישור (Human-in-the-Loop). Morning תמיד מציג preview לפני הנפקה אמיתית.

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
