import { describe, expect, it } from 'vitest';
import { validateLead } from './platform-lead';

const ok = { contactName: ' דנה  כהן ', nurseryName: 'משתלת הדר', phone: '050-1234567', email: 'Dana@Example.com', notes: 'שורה 1\r\nשורה 2' };

describe('validateLead', () => {
  it('trims, lowercases the email and keeps line breaks in the notes', () => {
    expect(validateLead(ok)).toEqual({ ok: true, lead: { contactName: 'דנה כהן', nurseryName: 'משתלת הדר', phone: '050-1234567', email: 'dana@example.com', notes: 'שורה 1\nשורה 2' } });
  });

  it('every field except the notes is required', () => {
    expect(validateLead({ ...ok, contactName: '' })).toEqual({ ok: false, error: 'נא למלא שם איש קשר' });
    expect(validateLead({ ...ok, nurseryName: ' ' })).toEqual({ ok: false, error: 'נא למלא את שם המשתלה' });
    expect(validateLead({ ...ok, phone: '' })).toEqual({ ok: false, error: 'נא למלא טלפון' });
    expect(validateLead({ ...ok, email: '' })).toEqual({ ok: false, error: 'נא למלא כתובת מייל' });
    expect(validateLead({ ...ok, notes: undefined })).toMatchObject({ ok: true, lead: { notes: '' } });
  });

  it('rejects a bad phone or email', () => {
    expect(validateLead({ ...ok, phone: '12345' })).toEqual({ ok: false, error: 'מספר הטלפון אינו תקין' });
    expect(validateLead({ ...ok, phone: 'abc-defghij' })).toEqual({ ok: false, error: 'מספר הטלפון אינו תקין' });
    expect(validateLead({ ...ok, email: 'dana@' })).toEqual({ ok: false, error: 'כתובת המייל אינה תקינה' });
    expect(validateLead({ ...ok, phone: '+972 50 123 4567' })).toMatchObject({ ok: true });
  });
});
