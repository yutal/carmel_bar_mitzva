# עמדת ברכות AI · בר המצווה של כרמל

אורחים סורקים QR, עונים על כמה שאלות, כותבים ברכה ומקבלים פוסטר קולנועי אישי ו/או שיר אישי שנוצרו ב-AI.
כל הגשה נשמרת כקבצים בשם `full_name_YYYYMMDD_HHMMSS`.

| נתיב | מה זה |
| --- | --- |
| `/` | זרימת האורח (מובייל, עברית) |
| `/r/<id>` | דף התוצאה האישי של האורח |
| `/screen` | מצגת למסך באולם, עם QR להצטרפות |
| `/admin` | ניהול (משתמש `admin`, סיסמה מ-`ADMIN_PASSWORD`) |

## הרצה מקומית

```bash
cp .env.example .env.local   # למלא OPENAI_API_KEY ו-ADMIN_PASSWORD, או AI_PROVIDER=mock
npm install
npm run dev
```

`AI_PROVIDER=mock` מריץ את כל הזרימה בלי מפתחות (טקסט ותמונות דמה).

## ארכיטקטורה

```
src/app/            מסכים ו-API routes
src/lib/pipeline/   ניתוח → קונספט → פרומפט/מילים → יצירה → הרכבה, עם תור (p-queue) והמשך אחרי ריסטארט
src/lib/providers/  LLM / תמונה / מוזיקה מאחורי ממשקים (providers/index.ts בוחר)
src/lib/prompts/    כל הפרומפטים
src/lib/compose/    הרכבת הפוסטר והעטיפה: הטקסט העברי נכתב בקוד (@napi-rs/canvas), לא במודל
src/lib/storage/    קבצים בתיקיות, כתיבה אטומית
src/proxy.ts        Basic Auth ל-/admin ול-/api/admin
```

תיקיית הנתונים (`DATA_DIR`):

```
event.json  celebrant/  uploads/  blessings/  images/  songs/
```

שיר: ל-Suno אין API רשמי, ולכן ברירת המחדל היא "ידני": המערכת כותבת מילים וסגנון, והמנהל מעתיק אותם ל-Suno מהדשבורד
ומעלה את ה-MP3 חזרה. ספק אוטומטי נכנס דרך `MusicProvider`.

## פריסה ל-Railway

1. New Project → Deploy from GitHub repo → לבחור את הריפו (הוא נבנה מה-Dockerfile).
2. להוסיף Volume עם mount path `/data`.
3. Variables: `OPENAI_API_KEY`, `ADMIN_PASSWORD`.
4. Settings → Networking → Generate Domain. את הכתובת הזו שמים ב-QR.

## פרטיות

- תמונת אורח נשלחת ל-OpenAI רק אם האורח העלה אותה אחרי הודעת ההסכמה; מטא-דאטה (כולל GPS) נמחק.
- יצירה עולה למסך האולם רק בהסכמה, ואפשר להסתיר אותה מהדשבורד.
- הייצוא לא כולל את תמונות האורחים המקוריות אלא אם מבקשים `?uploads=1`.
