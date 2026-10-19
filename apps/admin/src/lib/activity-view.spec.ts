import type { AdminActivityItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import {
  activityActionLabel,
  activitySummary,
  activityTargetHref,
  toActivityRowVM,
} from './activity-view';

const ID = '0199f000-0000-7000-8000-000000000001';

function item(patch: Partial<AdminActivityItem> = {}): AdminActivityItem {
  return {
    id: ID,
    createdAt: '2026-10-19T09:30:00.000Z',
    actor: { id: ID, label: 'Owner Olive', role: 'ADMIN' },
    action: 'tours.setPublished',
    area: 'tours',
    target: { type: 'tour', id: ID, label: 'Ha Long Bay Cruise', ref: 'ha-long' },
    details: { published: false },
    ...patch,
  };
}

describe('activityActionLabel', () => {
  it('thao tác bật/tắt đọc chiều từ details', () => {
    expect(activityActionLabel('tours.setPublished', { published: true })).toBe('Put on sale');
    expect(activityActionLabel('tours.setPublished', { published: false })).toBe('Took off sale');
    expect(activityActionLabel('categories.setActive', { active: false })).toBe('Hid category');
    expect(activityActionLabel('destinations.setActive', { active: true })).toBe(
      'Showed destination',
    );
    expect(activityActionLabel('departures.setStatus', { status: 'CLOSED' })).toBe(
      'Closed departure',
    );
    expect(activityActionLabel('users.setRole', { role: 'STAFF' })).toBe('Granted Staff access');
    expect(activityActionLabel('users.setRole', { role: 'CUSTOMER' })).toBe('Removed Staff access');
  });

  it('thiếu cờ thì về nhãn trung tính; khoá lạ in nguyên khoá', () => {
    expect(activityActionLabel('tours.setPublished', {})).toBe('Changed sale status');
    expect(activityActionLabel('tours.archive', {})).toBe('tours.archive');
    expect(activityActionLabel('bookings.export', {})).toBe('Exported bookings');
  });
});

describe('activitySummary', () => {
  it('hoàn tiền: số tiền theo tiền tệ và hoàn hết hay một phần', () => {
    expect(
      activitySummary('bookings.refund', { amount: '120.00', currency: 'USD', full: true }),
    ).toBe('Refunded $120.00 (full)');
    expect(
      activitySummary('bookings.refund', { amount: '20.5', currency: 'USD', full: false }),
    ).toBe('Refunded $20.50 (partial)');
  });

  it('chữ của các vùng khác dùng lại nhãn sẵn có', () => {
    expect(activitySummary('enquiries.setStatus', { status: 'CONTACTED' })).toBe(
      'Moved to Contacted',
    );
    expect(activitySummary('outbox.retry', { emailType: 'BOOKING_CONFIRMATION' })).toBe(
      'Booking confirmation',
    );
    expect(activitySummary('reviews.moderate', { verdict: 'reject' })).toBe('Rejected');
  });

  it('số đếm có số ít, số nhiều', () => {
    expect(activitySummary('tours.setItinerary', { days: 1 })).toBe('1 day');
    expect(activitySummary('tours.setFaqsPolicies', { faqs: 4, policies: 1 })).toBe(
      '4 FAQs · 1 policy',
    );
    expect(activitySummary('tours.setCosts', { items: 3 })).toBe('3 cost lines');
    expect(activitySummary('destinations.setPhotos', { photos: 1 })).toBe('1 photo');
    expect(activitySummary('media.update', { uses: 0 })).toBe('Not in use');
    expect(activitySummary('users.revokeSessions', { sessions: 2 })).toBe('2 sessions ended');
  });

  it('chuyến: ngày đi; bài viết: trạng thái; danh mục: chiều đổi chỗ', () => {
    expect(activitySummary('departures.cancel', { startDate: '2026-11-12' })).toBe(
      'Departs 12 Nov 2026',
    );
    expect(activitySummary('posts.update', { status: 'DRAFT' })).toBe('Saved as draft');
    expect(activitySummary('categories.move', { direction: 'up' })).toBe('Up one place');
  });

  it('xuất Excel: số dòng và phạm vi; báo cáo: tháng', () => {
    expect(
      activitySummary('bookings.export', { rows: 42, mode: 'selection', filtered: true }),
    ).toBe('42 rows · selected rows');
    expect(activitySummary('subscribers.export', { rows: 1, mode: 'all', filtered: true })).toBe(
      '1 row · filtered',
    );
    expect(activitySummary('bookings.export', { rows: 9, mode: 'all', filtered: false })).toBe(
      '9 rows · everything',
    );
    expect(activitySummary('reports.export', { month: '2026-09' })).toBe('September 2026');
  });

  it('thiếu hoặc sai kiểu chi tiết thì không có câu tóm tắt, không ném', () => {
    expect(activitySummary('bookings.refund', { amount: 12 })).toBeNull();
    expect(activitySummary('tours.setItinerary', { days: 'three' })).toBeNull();
    expect(activitySummary('tours.create', {})).toBeNull();
    expect(activitySummary('tours.archive', { anything: 1 })).toBeNull();
  });
});

describe('activityTargetHref', () => {
  it('mỗi loại có trang riêng dẫn đúng chỗ (spec §6)', () => {
    expect(activityTargetHref('booking', 'BK-ABCD1234')).toBe('/bookings/BK-ABCD1234');
    expect(activityTargetHref('enquiry', ID)).toBe(`/enquiries/${ID}`);
    expect(activityTargetHref('tour', 'ha-long')).toBe('/tours/ha-long');
    expect(activityTargetHref('departure', 'ha-long')).toBe('/tours/ha-long/departures');
    expect(activityTargetHref('post', 'best-pho')).toBe('/posts/best-pho');
    expect(activityTargetHref('destination', 'hoi-an')).toBe('/destinations/hoi-an/photos');
    expect(activityTargetHref('account', ID)).toBe(`/users/${ID}`);
    expect(activityTargetHref('slot', 'home.hero')).toBe('/appearance#home.hero');
  });

  it('không link khi đối tượng không còn hoặc không có trang riêng', () => {
    expect(activityTargetHref('tour', null)).toBeNull();
    for (const type of ['review', 'email', 'category', 'photo', 'subscriber']) {
      expect(activityTargetHref(type, 'x')).toBeNull();
    }
  });
});

describe('toActivityRowVM', () => {
  it('giờ UTC, người làm kèm bậc, nhãn thao tác, đối tượng có link', () => {
    expect(toActivityRowVM(item())).toEqual({
      id: ID,
      when: '19 Oct 2026, 09:30 UTC',
      who: 'Owner Olive',
      roleLabel: 'Owner',
      roleVariant: 'default',
      what: 'Took off sale',
      summary: null,
      area: 'Tours',
      item: { label: 'Ha Long Bay Cruise', isFallback: false, href: '/tours/ha-long' },
    });
  });

  it('nhãn trống thì chữ thay thế; xuất Excel không có đối tượng', () => {
    const unsubscribed = toActivityRowVM(
      item({
        action: 'subscribers.unsubscribe',
        area: 'subscribers',
        target: { type: 'subscriber', id: ID, label: null, ref: null },
        details: {},
      }),
    );
    expect(unsubscribed.item).toEqual({ label: 'a subscriber', isFallback: true, href: null });

    const exported = toActivityRowVM(
      item({
        actor: { id: null, label: 'Staff Sam', role: 'STAFF' },
        action: 'bookings.export',
        area: 'bookings',
        target: null,
        details: { rows: 3, mode: 'all', filtered: false },
      }),
    );
    expect(exported).toMatchObject({
      roleLabel: 'Staff',
      what: 'Exported bookings',
      summary: '3 rows · everything',
      item: null,
    });
  });
});
