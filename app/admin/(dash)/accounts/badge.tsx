import { BLOCK_REASON_TEXT, formatAccountDate, type AccountStatus } from '@/lib/nursery-billing';

/** מצב החשבון בקצרה: תקין, אזהרה לפני מועד, או חסום. */
export function AccountBadge({ status }: { status: AccountStatus }) {
  if (status.state === 'BLOCKED') {
    return (
      <span title={BLOCK_REASON_TEXT[status.reason]} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800" data-testid="account-status">
        {status.reason === 'SUSPENDED' ? 'מושהה' : 'חסום'}
      </span>
    );
  }
  if (status.state === 'WARNING') {
    return (
      <span title={`הגישה תיחסם ב-${formatAccountDate(status.blocksOn)}`} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900" data-testid="account-status">
        {status.dueInDays < 0 ? 'באיחור' : 'לפני מועד'}
      </span>
    );
  }
  return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800" data-testid="account-status">תקין</span>;
}
