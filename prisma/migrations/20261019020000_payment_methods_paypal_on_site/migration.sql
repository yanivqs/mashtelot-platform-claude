-- R05-06 / §10.03: PayPal, תשלום באיסוף, תשלום לשליח. תוספת ערכים ל-enum בלבד.
-- שחזור: הקוד הקודם אינו מציג את הערכים החדשים; PostgreSQL אינו תומך בהסרת ערך enum —
-- להסרה מלאה יש לוודא שאין שורות בשימוש ולבנות את הטיפוס מחדש (לא נדרש לשחזור פונקציונלי).
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAY_ON_PICKUP';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAY_ON_DELIVERY';
