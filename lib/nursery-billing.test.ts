import { describe, expect, it } from 'vitest';
import { accountStatus, billingDateAfterPayment, formatAccountDate, isAccountBlocked, israelToday, nextMonthlyBilling, parseDateInput } from './nursery-billing';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** צהריים בישראל באותו יום */
const at = (s: string) => new Date(`${s}T10:00:00.000Z`);
const monthly = (billingDate: string) => ({ billingDate: d(billingDate), validUntil: null, billingType: 'MONTHLY' as const, suspendedAt: null });

describe('accountStatus', () => {
  it('no account or no dates never blocks', () => {
    expect(accountStatus(null)).toEqual({ state: 'OK' });
    expect(accountStatus({ billingDate: null, validUntil: null, billingType: null, suspendedAt: null })).toEqual({ state: 'OK' });
  });
  it('warns 7 days before, stays open 3 grace days, blocks on the 4th day after the billing date', () => {
    const a = monthly('2026-12-10');
    expect(accountStatus(a, at('2026-12-02')).state).toBe('OK');
    expect(accountStatus(a, at('2026-12-03'))).toMatchObject({ state: 'WARNING', reason: 'OVERDUE', dueInDays: 7 });
    expect(accountStatus(a, at('2026-12-10'))).toMatchObject({ state: 'WARNING', dueInDays: 0 });
    expect(accountStatus(a, at('2026-12-13'))).toMatchObject({ state: 'WARNING', dueInDays: -3 });
    expect(isAccountBlocked(a, at('2026-12-13'))).toBe(false);
    expect(accountStatus(a, at('2026-12-14'))).toMatchObject({ state: 'BLOCKED', reason: 'OVERDUE' });
  });
  it('tells when the block starts', () => {
    const s = accountStatus(monthly('2026-12-10'), at('2026-12-09'));
    expect(s.state === 'WARNING' && formatAccountDate(s.blocksOn)).toBe('14/12/2026');
  });
  it('uses the day in Israel, not UTC', () => {
    // 22:30 UTC ב-13/12 הוא כבר 14/12 בישראל
    expect(isAccountBlocked(monthly('2026-12-10'), new Date('2026-12-13T22:30:00.000Z'))).toBe(true);
    expect(isAccountBlocked(monthly('2026-12-10'), new Date('2026-12-13T21:30:00.000Z'))).toBe(false);
  });
  it('one-time: blocks after valid-until; valid-until is ignored on monthly', () => {
    const once = { billingDate: null, validUntil: d('2026-12-31'), billingType: 'ONE_TIME' as const, suspendedAt: null };
    expect(accountStatus(once, at('2027-01-03')).state).toBe('WARNING');
    expect(accountStatus(once, at('2027-01-04'))).toMatchObject({ state: 'BLOCKED', reason: 'EXPIRED' });
    expect(isAccountBlocked({ ...once, billingType: 'MONTHLY' }, at('2027-06-01'))).toBe(false);
  });
  it('suspension blocks at once and carries the reason', () => {
    const a = { ...monthly('2030-01-01'), suspendedAt: new Date(), suspendReason: ' חוב ' };
    expect(accountStatus(a)).toEqual({ state: 'BLOCKED', reason: 'SUSPENDED', dueDate: null, note: 'חוב' });
  });
});

describe('payment', () => {
  it('next monthly date keeps the day and clamps to the month end', () => {
    expect(formatAccountDate(nextMonthlyBilling(d('2026-11-15')))).toBe('15/12/2026');
    expect(formatAccountDate(nextMonthlyBilling(d('2027-01-31')))).toBe('28/02/2027');
    expect(formatAccountDate(nextMonthlyBilling(d('2026-12-31')))).toBe('31/01/2027');
  });
  it('monthly moves forward past today even after months of delay; one-time closes', () => {
    const paid = billingDateAfterPayment({ billingDate: d('2026-08-10'), billingType: 'MONTHLY' }, at('2026-11-20'));
    expect(formatAccountDate(paid)).toBe('10/12/2026');
    expect(billingDateAfterPayment({ billingDate: d('2026-08-10'), billingType: 'ONE_TIME' }, at('2026-11-20'))).toBeNull();
  });
});

describe('dates', () => {
  it('formats DD/MM/YYYY and parses form values strictly', () => {
    expect(formatAccountDate(d('2027-03-05'))).toBe('05/03/2027');
    expect(formatAccountDate(null)).toBe('—');
    expect(parseDateInput('2027-03-05')?.toISOString()).toBe('2027-03-05T00:00:00.000Z');
    expect(parseDateInput('2027-02-31')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
  it('israelToday is a UTC midnight date', () => {
    expect(israelToday(new Date('2026-12-13T22:30:00.000Z')).toISOString()).toBe('2026-12-14T00:00:00.000Z');
  });
});
