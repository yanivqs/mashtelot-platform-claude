-- Enable Row-Level Security on every table in the public schema.
-- The app talks to Postgres exclusively through Prisma using the
-- `postgres` role (see DATABASE_URL / DIRECT_URL), which has BYPASSRLS
-- and is unaffected by this change. This only blocks Supabase's
-- auto-generated PostgREST API (anon/authenticated roles), which is
-- otherwise publicly reachable with just the project URL.
-- No policies are added, so PostgREST access is default-deny.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nurseries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursery_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "static_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "master_supplies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursery_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_loyalty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_global_options" ENABLE ROW LEVEL SECURITY;
