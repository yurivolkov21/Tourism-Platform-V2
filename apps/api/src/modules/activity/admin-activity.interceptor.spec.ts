import { call, implement, ORPCError } from '@orpc/server';
import { contract } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../generated/prisma/enums.js';
import { ACTIVITY_DESCRIBERS, type ActivityEntry } from './activity-describers.js';
import type { ActivityActor } from './activity-recorder.js';
import { type ActivityRecordFn, withActivity } from './admin-activity.interceptor.js';

/**
 * Middleware nhật ký (ADR-0061 §3, §4) chạy với procedure oRPC thật, bộ ghi giả: ghi đúng một lần
 * SAU khi handler thành công, không ghi khi handler ném hay input sai, không đổi output.
 */
const actor: ActivityActor = {
  id: 'a0000000-0000-4000-8000-000000000001',
  label: 'Owner',
  role: UserRole.ADMIN,
};
const TOUR_ID = 'b0000000-0000-4000-8000-000000000002';

function setPublished(
  handler: () => Promise<{ id: string; isPublished: boolean; changed: boolean }>,
) {
  return implement(contract.admin.tours.setPublished).handler(handler);
}

describe('withActivity — middleware nhật ký trên procedure thật', () => {
  it('handler thành công → ghi đúng một lần, output giữ nguyên', async () => {
    const record = vi.fn<ActivityRecordFn>(async () => {});
    const handler = vi.fn(async () => ({ id: TOUR_ID, isPublished: false, changed: true }));
    const wrapped = withActivity(setPublished(handler), 'tours.setPublished', () => actor, record);

    const output = await call(wrapped as ReturnType<typeof setPublished>, {
      id: TOUR_ID,
      isPublished: false,
    });

    expect(output).toEqual({ id: TOUR_ID, isPublished: false, changed: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]?.[0]).toBe(actor);
    expect(record.mock.calls[0]?.[1]).toBe('tours.setPublished');
  });

  it('handler ném → không ghi, lỗi đi nguyên ra ngoài', async () => {
    const record = vi.fn<ActivityRecordFn>(async () => {});
    const wrapped = withActivity(
      setPublished(async () => {
        throw new ORPCError('NOT_FOUND');
      }),
      'tours.setPublished',
      () => actor,
      record,
    );

    await expect(
      call(wrapped as ReturnType<typeof setPublished>, { id: TOUR_ID, isPublished: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(record).not.toHaveBeenCalled();
  });

  it('input sai → handler không chạy, không ghi (middleware nằm SAU bước kiểm input)', async () => {
    const record = vi.fn<ActivityRecordFn>(async () => {});
    const handler = vi.fn(async () => ({ id: TOUR_ID, isPublished: true, changed: true }));
    const wrapped = withActivity(setPublished(handler), 'tours.setPublished', () => actor, record);

    await expect(
      call(
        wrapped as ReturnType<typeof setPublished>,
        {
          id: 'not-a-uuid',
          isPublished: true,
        } as never,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(handler).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('phiên không phải admin (lưới) → không ghi', async () => {
    const record = vi.fn<ActivityRecordFn>(async () => {});
    const wrapped = withActivity(
      setPublished(async () => ({ id: TOUR_ID, isPublished: true, changed: true })),
      'tours.setPublished',
      () => null,
      record,
    );
    await call(wrapped as ReturnType<typeof setPublished>, { id: TOUR_ID, isPublished: true });
    expect(record).not.toHaveBeenCalled();
  });

  it('thứ không phải procedure đi qua nguyên vẹn', () => {
    const value = { not: 'a procedure' };
    expect(withActivity(value, 'tours.setPublished', () => actor)).toBe(value);
  });
});

describe('ACTIVITY_DESCRIBERS — các mô tả không cần DB', () => {
  it('hoàn tiền: đối tượng là mã đơn, chi tiết là số tiền, tiền tệ, đã hoàn hết hay chưa', async () => {
    const entry = await ACTIVITY_DESCRIBERS['bookings.refund'].describe({
      input: { code: 'BK-ABCD1234', amount: '120.00', reason: 'Goodwill' },
      output: {
        booking: { code: 'BK-ABCD1234', currency: 'USD', status: 'PARTIALLY_REFUNDED' },
        refunds: [],
      } as never,
      before: null,
    });
    expect(entry).toEqual<ActivityEntry>({
      target: { type: 'booking', id: 'BK-ABCD1234', label: 'BK-ABCD1234' },
      details: { amount: '120.00', currency: 'USD', full: false },
    });
  });

  it('đổi trạng thái enquiry không đổi gì → không ghi', async () => {
    const entry = await ACTIVITY_DESCRIBERS['enquiries.setStatus'].describe({
      input: { id: TOUR_ID, status: 'WON' },
      output: { id: TOUR_ID, name: 'Linh', status: 'WON', changed: false },
      before: null,
    });
    expect(entry).toBeNull();
  });

  it('gửi lại email: không lưu người nhận, chỉ loại email', async () => {
    const entry = await ACTIVITY_DESCRIBERS['outbox.retry'].describe({
      input: { id: TOUR_ID },
      output: {
        id: TOUR_ID,
        type: 'BOOKING_CONFIRMATION',
        recipient: 'guest@example.com',
      } as never,
      before: null,
    });
    expect(entry).toEqual({
      target: { type: 'email', id: TOUR_ID, label: null },
      details: { emailType: 'BOOKING_CONFIRMATION' },
    });
    expect(JSON.stringify(entry)).not.toContain('guest@example.com');
  });

  it('đổi chỗ danh mục: nhãn là hàng của input trong danh sách trả về', async () => {
    const entry = await ACTIVITY_DESCRIBERS['categories.move'].describe({
      input: { id: TOUR_ID, direction: 'up' },
      output: [
        { id: 'c0000000-0000-4000-8000-000000000009', name: 'Beach' },
        { id: TOUR_ID, name: 'Culture' },
      ] as never,
      before: null,
    });
    expect(entry).toEqual({
      target: { type: 'category', id: TOUR_ID, label: 'Culture' },
      details: { direction: 'up' },
    });
  });

  it('lệnh xoá dùng nhãn đọc TRƯỚC khi chạy', async () => {
    const entry = await ACTIVITY_DESCRIBERS['tours.delete'].describe({
      input: { id: TOUR_ID },
      output: { slug: 'ha-long' },
      before: 'Ha Long Bay Cruise',
    });
    expect(entry).toEqual({ target: { type: 'tour', id: TOUR_ID, label: 'Ha Long Bay Cruise' } });
  });

  it('sửa ảnh: nhãn là chỗ dùng đầu tiên, chi tiết là số chỗ dùng', async () => {
    const entry = await ACTIVITY_DESCRIBERS['media.update'].describe({
      input: {} as never,
      output: {
        publicId: 'tourism/tours/x',
        usages: [{ label: 'Hoi An Lanterns' }, { label: 'Hoi An' }],
      } as never,
      before: null,
    });
    expect(entry).toEqual({
      target: { type: 'photo', id: 'tourism/tours/x', label: 'Hoi An Lanterns' },
      details: { uses: 2 },
    });
  });
});
