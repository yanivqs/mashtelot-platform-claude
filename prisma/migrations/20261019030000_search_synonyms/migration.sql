-- R04-03: מילון נרדפות גלובלי לחיפוש. תוספת בלבד: טבלה חדשה + רשימה התחלתית (נבדקה ואושרה ע"י הבעלים).
-- RLS ללא policies + ללא הרשאות לתפקידים הציבוריים (כמו C-P0-02).
-- שחזור: הקוד הקודם אינו משתמש בטבלה; הסרה מלאה: DROP TABLE "search_synonym_groups";

-- CreateTable
CREATE TABLE "search_synonym_groups" (
    "id" TEXT NOT NULL,
    "terms" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_synonym_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "search_synonym_groups" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "search_synonym_groups" FROM anon, authenticated;
  END IF;
END $$;

-- רשימה התחלתית (ניתנת לעריכה במסך הניהול)
INSERT INTO "search_synonym_groups" ("id", "terms", "updated_at") VALUES
  (gen_random_uuid()::text, ARRAY['סוקולנט', 'סוקולנטים', 'בשרנים', 'בשרני'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['ריחן', 'בזיליקום'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['נענע', 'מנטה'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['שמיר', 'דיל'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['כוסברה', 'כוסבר'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['פטרוזיליה', 'פטרוסיליה'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['רוזמרין', 'רוזמרינוס'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['בוגנוויליה', 'בוגונביליה', 'בוגנויליה'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['גרניום', 'פלרגוניום'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['צמחי בית', 'צמחי פנים', 'צמח בית', 'צמח פנים'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['תבלינים', 'צמחי תבלין', 'עשבי תיבול'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['אדמה', 'מצע', 'מצע שתילה', 'אדמת שתילה', 'תערובת שתילה'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['דשן', 'דישון'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['הדברה', 'חומר הדברה', 'קוטל חרקים', 'ריסוס'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['דשא', 'מדשאה'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['טפטוף', 'טפטפת', 'טפטפות'], CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, ARRAY['מזמרה', 'מספרי גיזום'], CURRENT_TIMESTAMP);
