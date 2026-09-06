import 'server-only';
import { formatPrice } from '@/lib/utils';

/**
 * שליחת מיילים טרנזקציוניים דרך Resend (REST API, ללא SDK).
 *
 * הגדרה: RESEND_API_KEY + EMAIL_FROM (למשל "משתלות מ.נט <orders@mashtelot.net>").
 * הדומיין חייב להיות מאומת ב-Resend. אם המפתח חסר — הפונקציה לא נכשלת,
 * רק רושמת אזהרה, כדי שתהליך ההזמנה לא ישבר.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/EMAIL_FROM חסרים — דילוג על שליחת מייל:', subject);
    return { ok: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[email] שליחה נכשלה', res.status, detail);
      return { ok: false, error: `resend ${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('[email] שגיאת רשת בשליחה', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- תבניות ----------

interface OrderEmailData {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string | null;
  totalAmount: string | number;
  items: Array<{ productTitle: string; quantity: number; unitPrice: string | number }>;
  nurseryName: string;
  nurseryPhone?: string | null;
  storeUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function itemRows(items: OrderEmailData['items']): string {
  return items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;color:#374151">${escapeHtml(i.productTitle)} × ${i.quantity}</td>
        <td style="padding:6px 0;text-align:left;color:#111827;white-space:nowrap">${formatPrice(
          Number(i.unitPrice) * i.quantity,
        )}</td>
      </tr>`,
    )
    .join('');
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #f0f0f0;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(title)}</h1>
      ${body}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">נשלח ממערכת המשתלות</p>
  </div></body></html>`;
}

/** אישור הזמנה ללקוח. */
export function orderConfirmationEmail(o: OrderEmailData): { subject: string; html: string } {
  const subject = `אישור הזמנה #${o.id.slice(0, 8)} · ${o.nurseryName}`;
  const html = shell('ההזמנה שלך התקבלה!', `
    <p style="color:#374151;line-height:1.6">
      שלום ${escapeHtml(o.customerName)},<br>
      תודה שהזמנת מ<strong>${escapeHtml(o.nurseryName)}</strong>. המשתלה תיצור איתך קשר
      בטלפון ${escapeHtml(o.customerPhone)} לתיאום תשלום ואיסוף/משלוח.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      ${itemRows(o.items)}
      <tr><td colspan="2" style="border-top:1px solid #e5e7eb"></td></tr>
      <tr>
        <td style="padding:8px 0;font-weight:bold;color:#111827">סה"כ</td>
        <td style="padding:8px 0;text-align:left;font-weight:bold;color:#111827">${formatPrice(o.totalAmount)}</td>
      </tr>
    </table>
    ${o.shippingAddress ? `<p style="color:#6b7280;font-size:13px">כתובת למשלוח: ${escapeHtml(o.shippingAddress)}</p>` : ''}
    <p style="color:#9ca3af;font-size:12px">מספר הזמנה מלא: ${escapeHtml(o.id)}</p>
    ${o.storeUrl ? `<a href="${escapeHtml(o.storeUrl)}" style="display:inline-block;margin-top:8px;background:#16a34a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">חזרה לחנות</a>` : ''}
  `);
  return { subject, html };
}

/** התראה לבעל המשתלה על הזמנה חדשה. */
export function newOrderNotificationEmail(o: OrderEmailData): { subject: string; html: string } {
  const subject = `הזמנה חדשה #${o.id.slice(0, 8)} · ${formatPrice(o.totalAmount)}`;
  const html = shell('התקבלה הזמנה חדשה', `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;color:#374151">
      <tr><td style="padding:4px 0;width:90px;color:#6b7280">לקוח</td><td>${escapeHtml(o.customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">טלפון</td><td>${escapeHtml(o.customerPhone)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">אימייל</td><td>${escapeHtml(o.customerEmail)}</td></tr>
      ${o.shippingAddress ? `<tr><td style="padding:4px 0;color:#6b7280">משלוח</td><td>${escapeHtml(o.shippingAddress)}</td></tr>` : ''}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:14px">
      ${itemRows(o.items)}
      <tr><td colspan="2" style="border-top:1px solid #e5e7eb"></td></tr>
      <tr>
        <td style="padding:8px 0;font-weight:bold;color:#111827">סה"כ</td>
        <td style="padding:8px 0;text-align:left;font-weight:bold;color:#111827">${formatPrice(o.totalAmount)}</td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:12px">ההזמנה ממתינה לטיפול בפורטל הניהול · /admin/orders</p>
  `);
  return { subject, html };
}
