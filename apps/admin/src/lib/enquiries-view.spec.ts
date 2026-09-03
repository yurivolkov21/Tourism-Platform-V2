import type { EnquiryDetail, EnquiryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  enquiryStatusBadgeVariant,
  toEnquiryDetailVM,
  toEnquiryRowVM,
  tourFilterLabel,
} from './enquiries-view';

/**
 * Mapper hiển thị vùng `/enquiries` (spec P4c §3-F9) — THUẦN, ngoài React nên
 * test được từng nhánh; bảng và trang chi tiết chỉ render VM có sẵn.
 */
const t = messages.admin.enquiries;

const TOUR_ID = '0198c000-0000-7000-8000-0000000000aa';

const row: EnquiryRow = {
  id: '0198c000-0000-7000-8000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+84 90 000 0000',
  tourTitle: 'Hoi An Lantern Evening',
  tourSlug: 'hoi-an-lantern-evening',
  travelDate: '2026-12-24',
  groupSize: 4,
  budgetTier: 'luxury',
  status: 'NEW',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
  notesCount: 2,
};

describe('enquiryStatusBadgeVariant', () => {
  it('WON nổi bật, LOST trung tính-viền, ba trạng thái đang mở nhạt — một trạng thái một màu', () => {
    expect(enquiryStatusBadgeVariant('WON')).toBe('default');
    expect(enquiryStatusBadgeVariant('LOST')).toBe('outline');
    expect(enquiryStatusBadgeVariant('NEW')).toBe('secondary');
    expect(enquiryStatusBadgeVariant('CONTACTED')).toBe('secondary');
    expect(enquiryStatusBadgeVariant('QUOTED')).toBe('secondary');
  });

  it('KHÔNG có trạng thái nào tô destructive — LOST là một kết cục kinh doanh, không phải lỗi', () => {
    for (const status of ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'] as const) {
      expect(enquiryStatusBadgeVariant(status)).not.toBe('destructive');
    }
  });
});

describe('toEnquiryRowVM', () => {
  it('row đầy đủ: nhãn trạng thái/tour/ngày/đoàn/note đã nấu sẵn, href chi tiết dựng từ id', () => {
    expect(toEnquiryRowVM(row)).toEqual({
      id: row.id,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      href: `/enquiries/${row.id}`,
      tourTitle: 'Hoi An Lantern Evening',
      travelDate: '24 Dec 2026',
      groupSize: '4 travellers',
      budgetTier: 'luxury',
      status: 'NEW',
      statusLabel: t.status.NEW,
      notesCount: 2,
      notesLabel: t.list.notesCount(2),
      created: '1 Sep 2026, 10:00 UTC',
    });
  });

  it('enquiry chung: tourTitle null → VM in chữ "General enquiry" thay vì ô trống', () => {
    expect(toEnquiryRowVM({ ...row, tourTitle: null, tourSlug: null }).tourTitle).toBe(
      t.list.noTour,
    );
  });

  it('field optional vắng → null, bảng tự in gạch (VM không bịa "0" hay chuỗi rỗng)', () => {
    const vm = toEnquiryRowVM({ ...row, travelDate: null, groupSize: null, budgetTier: null });
    expect(vm.travelDate).toBeNull();
    expect(vm.groupSize).toBeNull();
    expect(vm.budgetTier).toBeNull();
  });

  it('groupSize 1 dùng số ít — "1 traveller", không phải "1 travellers"', () => {
    expect(toEnquiryRowVM({ ...row, groupSize: 1 }).groupSize).toBe('1 traveller');
  });

  it('notesLabel số ít/số nhiều, và 0 note vẫn có nhãn đọc được', () => {
    expect(toEnquiryRowVM({ ...row, notesCount: 1 }).notesLabel).toBe('1 note');
    expect(toEnquiryRowVM({ ...row, notesCount: 0 }).notesLabel).toBe('0 notes');
  });
});

describe('tourFilterLabel', () => {
  it('không lọc theo tour → null (không có chip nào để vẽ)', () => {
    expect(tourFilterLabel([row], undefined)).toBeNull();
  });

  it('lọc theo tour → tên tour đọc từ hàng đầu tiên (mọi hàng cùng một tour)', () => {
    expect(tourFilterLabel([row], TOUR_ID)).toBe('Hoi An Lantern Evening');
  });

  it('tập lọc RỖNG (hoặc hàng không có tên tour) → chữ thay thế, không in uuid thô ra màn hình', () => {
    expect(tourFilterLabel([], TOUR_ID)).toBe(t.list.tourFilterUnknown);
    expect(tourFilterLabel([{ ...row, tourTitle: null }], TOUR_ID)).toBe(t.list.tourFilterUnknown);
  });
});

describe('toEnquiryDetailVM', () => {
  const detail: EnquiryDetail = {
    ...row,
    message: 'We would like a private tour for four.',
    nationality: 'United Kingdom',
    interests: ['food', 'photography'],
    notes: [
      {
        id: '0198c000-0000-7000-8000-00000000000a',
        authorName: 'Grace Hopper',
        body: 'Called the lead.',
        createdAt: '2026-09-01T11:00:00.000Z',
      },
    ],
    statusEvents: [
      {
        id: '0198c000-0000-7000-8000-00000000000b',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        adminName: 'Grace Hopper',
        createdAt: '2026-09-01T10:30:00.000Z',
      },
    ],
  };

  it('thẻ lead liệt kê MỌI field của contract, bỏ đúng những field trống', () => {
    const vm = toEnquiryDetailVM(detail);
    expect(vm.leadFields).toEqual([
      { label: t.detail.lead.email, value: 'ada@example.com' },
      { label: t.detail.lead.phone, value: '+84 90 000 0000' },
      { label: t.detail.lead.nationality, value: 'United Kingdom' },
      { label: t.detail.lead.tour, value: 'Hoi An Lantern Evening' },
      { label: t.detail.lead.travelDate, value: '24 Dec 2026' },
      { label: t.detail.lead.groupSize, value: '4 travellers' },
      { label: t.detail.lead.budgetTier, value: 'luxury' },
    ]);
    expect(vm.interests).toEqual(['food', 'photography']);
  });

  it('lead trống trơn: chỉ còn email (bắt buộc), interests rỗng — không dòng nào in "null"', () => {
    const vm = toEnquiryDetailVM({
      ...detail,
      phone: null,
      nationality: null,
      tourTitle: null,
      tourSlug: null,
      travelDate: null,
      groupSize: null,
      budgetTier: null,
      interests: [],
    });
    expect(vm.leadFields).toEqual([{ label: t.detail.lead.email, value: 'ada@example.com' }]);
    expect(vm.interests).toEqual([]);
  });

  it('note giữ NGUYÊN thứ tự server (cũ trước) và mang nhãn tác giả + mốc đã format', () => {
    const vm = toEnquiryDetailVM(detail);
    expect(vm.notes).toEqual([
      {
        id: '0198c000-0000-7000-8000-00000000000a',
        body: 'Called the lead.',
        author: t.detail.notes.by('Grace Hopper'),
        at: '1 Sep 2026, 11:00 UTC',
      },
    ]);
  });

  it('dòng audit đọc "New → Contacted" bằng NHÃN, không phải giá trị enum thô', () => {
    const vm = toEnquiryDetailVM(detail);
    expect(vm.statusEvents[0]).toEqual({
      id: '0198c000-0000-7000-8000-00000000000b',
      change: t.detail.history.change(t.status.NEW, t.status.CONTACTED),
      author: t.detail.history.by('Grace Hopper'),
      at: '1 Sep 2026, 10:30 UTC',
    });
  });

  it('adminName null (tài khoản đã bị xoá) → dòng audit vẫn đọc được, không "by null"', () => {
    const vm = toEnquiryDetailVM({
      ...detail,
      statusEvents: detail.statusEvents.map((event) => ({ ...event, adminName: null })),
    });
    expect(vm.statusEvents[0]?.author).toBe(t.detail.history.unknownAdmin);
  });
});
