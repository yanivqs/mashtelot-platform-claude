-- Wolt כערוץ חברתי + הערה פנימית להזמנה (נראית רק בניהול)
ALTER TYPE "ChannelProvider" ADD VALUE 'WOLT';
ALTER TABLE "orders" ADD COLUMN "admin_note" TEXT;
