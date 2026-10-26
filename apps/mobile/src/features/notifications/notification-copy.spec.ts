import { messages } from '@tourism/i18n';
import { describeNotification } from './notification-copy';
import type { AppNotification } from './notifications';

const base: AppNotification = {
  id: 'departing:BK-1',
  kind: 'departing',
  tourTitle: 'Ha Giang Loop',
  imageUrl: 'https://example.com/a.jpg',
  code: 'BK-1',
  reviewId: null,
};

describe('describeNotification', () => {
  it('sắp đi: nói rõ số ngày, hôm nay và ngày mai có câu riêng', () => {
    expect(describeNotification({ ...base, daysUntil: 5 }, true).body).toBe('Departs in 5 days');
    expect(describeNotification({ ...base, daysUntil: 1 }, true).body).toBe('Departs tomorrow');
    expect(describeNotification({ ...base, daysUntil: 0 }, true).body).toBe('Departs today');
  });

  it('mang theo ảnh, trạng thái chưa đọc và id của thông báo', () => {
    const row = describeNotification({ ...base, daysUntil: 3 }, false);
    expect(row).toMatchObject({
      id: 'departing:BK-1',
      imageUrl: 'https://example.com/a.jpg',
      unread: false,
      icon: 'calendar',
    });
    expect(row.title).toContain('Ha Giang Loop');
  });

  it('đang đi: "Day 2 of 4"', () => {
    const row = describeNotification(
      { ...base, kind: 'on_tour', dayOfTrip: 2, totalDays: 4 },
      true,
    );
    expect(row.body).toBe('Day 2 of 4');
  });

  it('thiếu tên tour thì dùng câu thay thế, không in "null"', () => {
    const row = describeNotification({ ...base, kind: 'payment_due', tourTitle: null }, true);
    expect(row.title).toContain(messages.mobile.notifications.fallbackTourTitle);
    expect(row.title).not.toContain('null');
  });

  it('mọi loại đều ra tiêu đề và nội dung không rỗng', () => {
    const kinds = [
      'payment_due',
      'on_tour',
      'departing',
      'trip_cancelled',
      'refunded',
      'review_prompt',
      'review_rejected',
      'review_approved',
    ] as const;
    for (const kind of kinds) {
      const row = describeNotification(
        { ...base, kind, dayOfTrip: 1, totalDays: 3, daysUntil: 2 },
        true,
      );
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.body.length).toBeGreaterThan(0);
    }
  });
});
