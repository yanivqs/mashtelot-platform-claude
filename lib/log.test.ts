import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError } from './log';

afterEach(() => vi.restoreAllMocks());

describe('structured log (§20.03)', () => {
  it('one JSON line with env, service, code, tenant and the error text', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError({ service: 'checkout', code: 'ORDER_CREATE_FAILED', nurseryId: 'n1' }, new Error('boom'));
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({ level: 'error', service: 'checkout', code: 'ORDER_CREATE_FAILED', nurseryId: 'n1', error: 'Error: boom' });
    expect(line.env).toBeTruthy();
    expect(line.at).toMatch(/^\d{4}-/);
  });
});
