-- SEC-02: גרסת session למשתמש. העלאת הערך מבטלת את כל ה-sessions הקיימים שלו.
-- תוספת בלבד: ברירת מחדל 0, ו-JWT ישן ללא גרסה נחשב לגרסה 0 — אין ניתוק בעת הפריסה.
-- שחזור: הקוד הקודם מתעלם מהעמודה; הסרה מלאה: ALTER TABLE "users" DROP COLUMN "session_version";
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
