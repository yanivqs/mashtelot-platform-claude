-- C-P0-02: RLS לכל הטבלאות + הסרת הרשאות התפקידים הציבוריים של Supabase.
--
-- רקע: מיגרציית 20260917000000 הפעילה RLS רק על הטבלאות שהיו קיימות אז. 11 טבלאות
-- שנוספו אחר כך, וגם _prisma_migrations, נשארו ללא RLS. ב-Supabase, default privileges
-- מעניקים ל-anon/authenticated הרשאות מלאות על כל טבלה חדשה, ולכן הטבלאות האלה היו
-- קריאות וניתנות לכתיבה דרך ה-Data API עם המפתח הציבורי (אומת על mashtelot-dev).
--
-- האפליקציה מתחברת כ-postgres (BYPASSRLS + בעלי הטבלאות) — לא מושפעת.
-- אין policies: גישת anon/authenticated = חסומה (default deny).
--
-- Rollback (ידני, אם יידרש):
--   ALTER TABLE "<table>" DISABLE ROW LEVEL SECURITY;  -- לכל טבלה ברשימה
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- 1. RLS
ALTER TABLE "nursery_payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursery_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_zone_cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plant_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plant_category_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursery_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursery_product_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- 2. Least privilege: התפקידים הציבוריים אינם צריכים גישה לסכמת public בכלל.
--    רק כשהתפקידים קיימים (Supabase); ב-Postgres מקומי השלב מדולג.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
