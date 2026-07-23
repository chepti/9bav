# הפעלה כמערכת חיה (Firebase + Google Drive)

עד שממלאים את המפתחות, האתר רץ במצב מקומי (נתונים בדפדפן בלבד).
כדי להפוך אותו לחי ומשותף, יש שלושה שלבים. סה"כ ~15 דקות.

## שלב 1 — פרויקט Firebase (ניהול משתמשים + נתונים)

1. היכנסו ל-https://console.firebase.google.com והקימו פרויקט חדש (למשל `gush-katif`).
2. **Authentication** → Get started → Sign-in method → הפעילו **Google**.
3. **Firestore Database** → Create database → מצב **Production** → בחרו אזור (למשל `eur3`).
4. **Firestore → Rules** → הדביקו את התוכן של [firestore.rules](firestore.rules) → Publish.
   - החליפו בתוך הקובץ את `ownerEmail()` לאימייל שלכם אם אינו `chepti@gmail.com`.
5. **Project settings (⚙️) → General → Your apps** → הוסיפו אפליקציית **Web** (`</>`).
   מ-"SDK setup and configuration" העתיקו את הערכים ל-`.env.local` (ראו שלב 3).
6. **Authentication → Settings → Authorized domains** → הוסיפו את הדומיין של האתר
   (למשל `chepti.com` או `9bav.chepti.com`) וגם `localhost`.

## שלב 2 — העלאת מדיה ל-Google Drive שלך

1. פתחו https://script.google.com → New project.
2. הדביקו את [docs/apps-script-drive.gs](docs/apps-script-drive.gs). `FOLDER_ID` כבר מוגדר
   לתיקייה ששיתפתם.
3. Deploy → New deployment → Web app → **Execute as: Me**, **Who has access: Anyone** → Deploy.
4. אשרו את הרשאות ה-Drive (יופיע מסך הרשאה חד־פעמי).
5. העתיקו את כתובת ה-Web app אל `VITE_DRIVE_ENDPOINT`.

## שלב 3 — חיבור הערכים

1. העתיקו את `.env.example` ל-`.env.local`.
2. מלאו את כל הערכים משלב 1 ושלב 2.
3. הרצה מקומית: `npm run dev` — עכשיו הכניסה תהיה "התחברות עם Google",
   והנתונים יישמרו ב-Firestore.
4. כניסה ראשונה עם האימייל של הבעלים → מקבל אוטומטית תפקיד **מודרטור**.
5. בתחתית העמוד לחצו **"טעינת יישובים ראשוניים"** פעם אחת כדי לאכלס את מסד הנתונים.

## מינוי מודרטורים ליישובים

לאחר שאדם נכנס פעם אחת (נוצר לו מסמך ב-`users`):
- דרך **Firestore → users → <המשתמש>** שנו את השדה `role` ל-`moderator`, **או**
- הרחיבו את הממשק כך שהבעלים ימנה מודרטורים (כללי האבטחה כבר מתירים למודרטור לעדכן תפקידים).

## הערת אבטחה

היישובים נשמרים כמסמך אחד עם נקודות העניין והמדיה בתוכו. כללי האבטחה מתירים לכל
משתמש מחובר לתרום (בסגנון ויקי). כדי לאכוף שרק מודרטור יכול *לאשר* פריט, כדאי בהמשך
לפצל את המדיה ל-subcollection עם בדיקות ברמת השדה. מתאים להשקה בקהילה מוכרת;
מומלץ לחזק לפני פתיחה רחבה.

## פריסה ל-Hostinger

```powershell
npm run build
scp -r -F "T:\.ssh\config" T:\CURSOR2\9BAV\dist\* hostinger:/home/u630483490/public_html/9bav/
```

(משתני ה-`.env.local` נצרבים לתוך ה-build; ודאו שהם מלאים לפני `npm run build`.)
