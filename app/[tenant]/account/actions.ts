'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { customerOtpEmail, sendEmail } from '@/lib/email';
import { issueOtp, normalizeEmail, verifyOtp } from '@/lib/customer-otp';
import { clearCustomerSession, createCustomerSession, getCustomer } from '@/lib/customer-session';

export interface AccountState {
  ok?: boolean;
  error?: string;
  /** שלב 2 בהתחברות: הקוד נשלח למייל הזה */
  sentTo?: string;
  values?: { fullName?: string; phone?: string };
}

const TOO_MANY = 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.';

/** המשתלה של החנות + המודול פעיל. ה-tenant מגיע מהנתיב שה-Proxy קבע לפי הדומיין. */
async function storeFor(tenant: string) {
  const nursery = await getNurseryByTenant(String(tenant || ''));
  if (!nursery || !(await isModuleEnabled(nursery.id, 'customer_accounts'))) return null;
  return nursery;
}

/** שלב 1: שליחת קוד למייל. התשובה זהה תמיד (לא חושפים אם יש חשבון). */
export async function requestCodeAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const nursery = await storeFor(String(fd.get('tenant') || ''));
  if (!nursery) return { error: 'החשבונות אינם פעילים בחנות זו' };
  const email = normalizeEmail(String(fd.get('email') || ''));
  if (!email) return { error: 'כתובת אימייל לא תקינה' };

  const ip = await clientIp();
  if (
    !(await rateLimit(`customer-otp:ip:${ip}`, 10, 15 * 60_000)).ok ||
    !(await rateLimit(`customer-otp:email:${nursery.id}:${email}`, 3, 15 * 60_000)).ok
  ) {
    return { error: TOO_MANY };
  }

  const code = await issueOtp(prisma, nursery.id, email);
  const mail = customerOtpEmail(nursery.name, code);
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (!sent.ok && !sent.skipped) return { error: 'שליחת המייל נכשלה. נסו שוב בעוד רגע.' };
  return { sentTo: email };
}

/** שלב 2: אימות הקוד → session ללקוח (נוצר אם חדש), הזמנות אורח קודמות משויכות. */
export async function verifyCodeAction(prev: AccountState, fd: FormData): Promise<AccountState> {
  const nursery = await storeFor(String(fd.get('tenant') || ''));
  if (!nursery) return { error: 'החשבונות אינם פעילים בחנות זו' };
  const email = normalizeEmail(String(fd.get('email') || ''));
  if (!email) return { error: 'כתובת אימייל לא תקינה' };
  if (!(await rateLimit(`customer-verify:ip:${await clientIp()}`, 20, 15 * 60_000)).ok) {
    return { sentTo: email, error: TOO_MANY };
  }

  const r = await verifyOtp(prisma, nursery.id, email, String(fd.get('code') || ''));
  if (!r.ok) return { sentTo: email, error: r.error };
  await createCustomerSession(r.customer);
  await recordAudit({
    nurseryId: nursery.id,
    actorEmail: email,
    action: r.created ? 'customer.registered' : 'customer.login',
    entityType: 'Customer',
    entityId: r.customer.id,
    metadata: { claimedOrders: r.claimedOrders },
  });
  revalidatePath('/[tenant]/account', 'page');
  return { ok: true };
}

export async function updateProfileAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const nursery = await storeFor(String(fd.get('tenant') || ''));
  if (!nursery) return { error: 'החשבונות אינם פעילים בחנות זו' };
  const customer = await getCustomer(nursery.id);
  if (!customer) return { error: 'יש להתחבר מחדש' };
  const fullName = String(fd.get('fullName') || '').trim().slice(0, 120);
  const phone = String(fd.get('phone') || '').trim().slice(0, 30);
  if (phone && !/^[0-9+\-\s()]{7,30}$/.test(phone)) return { error: 'מספר טלפון לא תקין', values: { fullName, phone } };
  const consent = fd.get('marketingConsent') === 'on';
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      fullName: fullName || null,
      phone: phone || null,
      // R06-09: מועד ההסכמה נשמר; ביטול מוחק אותו
      marketingConsentAt: consent ? (customer.marketingConsentAt ?? new Date()) : null,
    },
  });
  if (Boolean(customer.marketingConsentAt) !== consent) {
    await recordAudit({
      nurseryId: nursery.id,
      actorEmail: customer.email,
      action: consent ? 'customer.marketing_consent_given' : 'customer.marketing_consent_withdrawn',
      entityType: 'Customer',
      entityId: customer.id,
    });
  }
  revalidatePath('/[tenant]/account', 'page');
  return { ok: true };
}

export async function logoutAction(fd: FormData): Promise<void> {
  const nursery = await getNurseryByTenant(String(fd.get('tenant') || ''));
  const all = fd.get('all') === '1';
  if (nursery && all) {
    const c = await getCustomer(nursery.id);
    if (c) await prisma.customer.update({ where: { id: c.id }, data: { sessionVersion: { increment: 1 } } });
  }
  await clearCustomerSession();
  revalidatePath('/[tenant]/account', 'page');
}
