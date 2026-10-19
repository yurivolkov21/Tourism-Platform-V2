import { describe, expect, it } from 'vitest';
import { ADMIN_ACCESS, type AdminProcedureKey } from '../admin-access.js';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_AREAS,
  ACTIVITY_EXPORT_ACTIONS,
  ACTIVITY_LOGGED_PROCEDURES,
  ADMIN_ACTIVITY,
  AdminActivityItemSchema,
  AdminActivityListQuerySchema,
  AdminActivityRecordExportInputSchema,
  activityArea,
  exportActivityAction,
  isActivityAction,
  isLoggedProcedure,
} from './admin-activity.js';

/**
 * Danh sách 37 lệnh ghi ở spec nhật ký §3 (ADR-0061 §2). Sửa một dòng của `ADMIN_ACTIVITY` mà không
 * sửa danh sách này là test đỏ — CỐ Ý: bỏ một lệnh khỏi nhật ký phải là một quyết định.
 */
const LOGGED: AdminProcedureKey[] = [
  'bookings.refund',
  'reviews.moderate',
  'outbox.retry',
  'enquiries.setStatus',
  'enquiries.addNote',
  'subscribers.unsubscribe',
  'tours.create',
  'tours.updateDetails',
  'tours.setItinerary',
  'tours.setFaqsPolicies',
  'tours.setCosts',
  'tours.setPhotos',
  'tours.delete',
  'tours.setPublished',
  'categories.create',
  'categories.update',
  'categories.setActive',
  'categories.move',
  'categories.delete',
  'destinations.create',
  'destinations.update',
  'destinations.setActive',
  'destinations.delete',
  'destinations.setPhotos',
  'departures.create',
  'departures.update',
  'departures.cancel',
  'departures.setStatus',
  'posts.create',
  'posts.update',
  'posts.delete',
  'appearance.setSlot',
  'media.update',
  'users.setRole',
  'users.lock',
  'users.unlock',
  'users.revokeSessions',
];

describe('ADMIN_ACTIVITY — thủ tục nào vào nhật ký', () => {
  it('đúng 37 lệnh ghi của spec §3 là `log`', () => {
    expect([...ACTIVITY_LOGGED_PROCEDURES].sort()).toEqual([...LOGGED].sort());
  });

  it('phủ đúng mọi khoá của ADMIN_ACCESS, không thừa không thiếu', () => {
    expect(Object.keys(ADMIN_ACTIVITY).sort()).toEqual(Object.keys(ADMIN_ACCESS).sort());
  });

  it('ký tải lên và hai thủ tục của chính nhật ký là `skip`', () => {
    for (const key of [
      'tours.signPhotoUploads',
      'destinations.signPhotoUploads',
      'posts.signCoverUpload',
      'appearance.signUpload',
      'activity.list',
      'activity.recordExport',
    ] as const) {
      expect(ADMIN_ACTIVITY[key]).toBe('skip');
      expect(isLoggedProcedure(key)).toBe(false);
    }
    expect(isLoggedProcedure('tours.setPublished')).toBe(true);
  });
});

describe('khoá thao tác và khu vực', () => {
  it('37 lệnh ghi cộng ba lượt xuất', () => {
    expect(ACTIVITY_ACTIONS).toHaveLength(40);
    expect(ACTIVITY_EXPORT_ACTIONS).toEqual([
      'bookings.export',
      'subscribers.export',
      'reports.export',
    ]);
  });

  it('khu vực là phần trước dấu chấm, và mọi thao tác rơi vào một trong 14 khu vực', () => {
    expect(activityArea('tours.setPublished')).toBe('tours');
    expect(activityArea('reports.export')).toBe('reports');
    expect(ACTIVITY_AREAS).toHaveLength(14);
    const used = new Set(ACTIVITY_ACTIONS.map(activityArea));
    expect([...used].sort()).toEqual([...ACTIVITY_AREAS].sort());
  });

  it('isActivityAction nhận khoá đã biết, từ chối khoá đọc và chuỗi lạ', () => {
    expect(isActivityAction('bookings.refund')).toBe(true);
    expect(isActivityAction('subscribers.export')).toBe(true);
    expect(isActivityAction('bookings.list')).toBe(false);
    expect(isActivityAction('tours')).toBe(false);
  });

  it('exportActivityAction đổi loại xuất thành khoá thao tác', () => {
    expect(exportActivityAction('bookings')).toBe('bookings.export');
    expect(exportActivityAction('reports')).toBe('reports.export');
  });
});

describe('AdminActivityListQuerySchema', () => {
  it('URL trần: trang 1, mọi người, mọi khu vực, mọi ngày', () => {
    expect(AdminActivityListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('nhận đủ bộ lọc', () => {
    const query = AdminActivityListQuerySchema.parse({
      actorId: '0199e8a0-0000-7000-8000-000000000001',
      area: 'tours',
      from: '2026-10-01',
      to: '2026-10-19',
    });
    expect(query.area).toBe('tours');
    expect(query.from).toBe('2026-10-01');
  });

  it('từ chối khu vực lạ, id không phải uuid và khoảng ngày ngược', () => {
    expect(AdminActivityListQuerySchema.safeParse({ area: 'payments' }).success).toBe(false);
    expect(AdminActivityListQuerySchema.safeParse({ actorId: 'yuri' }).success).toBe(false);
    expect(
      AdminActivityListQuerySchema.safeParse({ from: '2026-10-19', to: '2026-10-01' }).success,
    ).toBe(false);
  });
});

describe('AdminActivityRecordExportInputSchema', () => {
  it('bookings và subscribers mang số dòng, kiểu xuất và cờ có lọc', () => {
    const input = AdminActivityRecordExportInputSchema.parse({
      kind: 'subscribers',
      rows: 12,
      mode: 'selection',
      filtered: true,
    });
    expect(input).toEqual({ kind: 'subscribers', rows: 12, mode: 'selection', filtered: true });
  });

  it('reports chỉ mang tháng', () => {
    expect(
      AdminActivityRecordExportInputSchema.parse({ kind: 'reports', month: '2026-10' }),
    ).toEqual({ kind: 'reports', month: '2026-10' });
    expect(AdminActivityRecordExportInputSchema.safeParse({ kind: 'reports' }).success).toBe(false);
  });

  it('từ chối loại lạ và số dòng âm', () => {
    expect(
      AdminActivityRecordExportInputSchema.safeParse({
        kind: 'users',
        rows: 1,
        mode: 'all',
        filtered: false,
      }).success,
    ).toBe(false);
    expect(
      AdminActivityRecordExportInputSchema.safeParse({
        kind: 'bookings',
        rows: -1,
        mode: 'all',
        filtered: false,
      }).success,
    ).toBe(false);
  });
});

describe('AdminActivityItemSchema', () => {
  const item = {
    id: '0199e8a0-0000-7000-8000-000000000002',
    createdAt: '2026-10-19T09:30:00.000Z',
    actor: { id: null, label: 'Former staff', role: 'STAFF' },
    action: 'tours.setPublished',
    area: 'tours',
    target: {
      type: 'tour',
      id: '0199e8a0-0000-7000-8000-000000000003',
      label: 'Ha Long',
      ref: null,
    },
    details: { published: false },
  };

  it('nhận dòng có người làm đã mất tài khoản và đối tượng đã xoá', () => {
    expect(AdminActivityItemSchema.parse(item)).toEqual(item);
  });

  it('nhận khoá thao tác cũ không còn trong danh sách — lịch sử không được làm hỏng cả trang', () => {
    expect(AdminActivityItemSchema.safeParse({ ...item, action: 'tours.archive' }).success).toBe(
      true,
    );
  });

  it('details chỉ là giá trị ngắn có kiểu, tối đa 8 khoá', () => {
    expect(
      AdminActivityItemSchema.safeParse({ ...item, details: { nested: { a: 1 } } }).success,
    ).toBe(false);
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, i]));
    expect(AdminActivityItemSchema.safeParse({ ...item, details: nine }).success).toBe(false);
  });
});
