import { contract } from '../contract.js';
import {
  AdminTourRowSchema,
  AdminTourSetPublishedInputSchema,
  AdminTourSetPublishedResultSchema,
  AdminToursListQuerySchema,
} from './admin-catalog.js';
import { CalendarMonthSchema } from './common.js';
import { ReportMonthSchema } from './reports.js';

/**
 * Contract vùng catalog admin (spec P4e-1 §3-F11). Schema là hợp đồng giữa
 * API và admin, nên test pin đúng những gì hai bên dựa vào: hình dạng hàng
 * `/tours`, trần/cận của query, và bề mặt hẹp của công tắc đăng.
 */

const validRow = {
  id: '7f2a1b3c-0000-4000-8000-000000000001',
  slug: 'hoi-an-lantern-evening',
  title: 'Hoi An Lantern Evening',
  categoryName: 'Day tours',
  basePrice: '39.00',
  currency: 'USD',
  isPublished: true,
  isFeatured: false,
  heroUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hoi-an.jpg',
  openDepartureCount: 3,
};

describe('AdminTourRowSchema', () => {
  it('nhận một hàng đầy đủ', () => {
    expect(AdminTourRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('tour chưa có ảnh hero → heroUrl null (khoá vẫn phải có mặt)', () => {
    expect(AdminTourRowSchema.parse({ ...validRow, heroUrl: null }).heroUrl).toBeNull();
    // `.nullable()` chứ không `.optional()`: thiếu khoá là dữ liệu hỏng, còn
    // null là "tour chưa gắn ảnh" — hai chuyện khác nhau (nếp `MediaItem`).
    const { heroUrl: _omitted, ...withoutHero } = validRow;
    expect(AdminTourRowSchema.safeParse(withoutHero).success).toBe(false);
  });

  it('tour không có chuyến nào → 0, và số âm bị từ chối', () => {
    expect(
      AdminTourRowSchema.parse({ ...validRow, openDepartureCount: 0 }).openDepartureCount,
    ).toBe(0);
    expect(AdminTourRowSchema.safeParse({ ...validRow, openDepartureCount: -1 }).success).toBe(
      false,
    );
  });

  it('giá là CHUỖI decimal, không phải số — tiền không bao giờ là float', () => {
    expect(AdminTourRowSchema.safeParse({ ...validRow, basePrice: 39 }).success).toBe(false);
    expect(AdminTourRowSchema.parse({ ...validRow, basePrice: '1299.50' }).basePrice).toBe(
      '1299.50',
    );
  });
});

describe('AdminToursListQuerySchema', () => {
  it('mặc định trang 1 · 20 dòng, không filter — cùng nếp admin.bookings.list', () => {
    expect(AdminToursListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('nhận ba filter: danh mục · trạng thái đăng · tháng khởi hành', () => {
    expect(
      AdminToursListQuerySchema.parse({
        categoryId: '7f2a1b3c-0000-4000-8000-0000000000aa',
        isPublished: false,
        month: '2026-11',
      }),
    ).toMatchObject({
      categoryId: '7f2a1b3c-0000-4000-8000-0000000000aa',
      isPublished: false,
      month: '2026-11',
    });
  });

  it('categoryId phải là uuid, month phải là YYYY-MM hợp lệ', () => {
    expect(AdminToursListQuerySchema.safeParse({ categoryId: 'day-tours' }).success).toBe(false);
    expect(AdminToursListQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(AdminToursListQuerySchema.safeParse({ month: '2026-11-01' }).success).toBe(false);
  });

  it('trần phân trang là trần dùng chung của mọi list admin', () => {
    expect(AdminToursListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(AdminToursListQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
  });
});

describe('CalendarMonthSchema', () => {
  it('là CÙNG MỘT schema với ReportMonthSchema — một luật tháng cho cả admin', () => {
    // Nâng lên `common.ts` khi có consumer thứ hai (nếp `CalendarDateSchema`,
    // `BookingCodeSchema`): hai bản regex sẽ trôi lệch nhau, và cái bẫy năm
    // legacy của `Date.UTC` thì cả hai chỗ đều dẫm phải.
    expect(ReportMonthSchema).toBe(CalendarMonthSchema);
  });
});

describe('AdminTourSetPublishedInputSchema', () => {
  it('đúng hai field: id và cờ mong muốn', () => {
    expect(
      AdminTourSetPublishedInputSchema.parse({
        id: '7f2a1b3c-0000-4000-8000-000000000001',
        isPublished: false,
      }),
    ).toEqual({ id: '7f2a1b3c-0000-4000-8000-000000000001', isPublished: false });
  });

  it('cờ BẮT BUỘC — công tắc gửi trạng thái ĐÍCH, không phải lệnh "đảo"', () => {
    // Đảo tại server là chỗ hai tab mở song song đá nhau: tab cũ bấm "đảo"
    // trên một hàng đã đổi sẽ đưa nó về đúng cái vừa bị bỏ.
    expect(
      AdminTourSetPublishedInputSchema.safeParse({
        id: '7f2a1b3c-0000-4000-8000-000000000001',
      }).success,
    ).toBe(false);
  });
});

describe('AdminTourSetPublishedResultSchema', () => {
  it('trả trạng thái SAU khi đổi, kèm cờ no-op', () => {
    expect(
      AdminTourSetPublishedResultSchema.parse({
        id: '7f2a1b3c-0000-4000-8000-000000000001',
        isPublished: false,
        changed: true,
      }),
    ).toEqual({
      id: '7f2a1b3c-0000-4000-8000-000000000001',
      isPublished: false,
      changed: true,
    });
  });

  it('KHÔNG chở `openDepartureCount` về', () => {
    // Con số ấy chỉ có nghĩa trong KHOẢNG LỌC của một lượt `list`; trả kèm ở
    // đây là in ra một số không ai định nghĩa được.
    expect(Object.keys(AdminTourSetPublishedResultSchema.shape).sort()).toEqual([
      'changed',
      'id',
      'isPublished',
    ]);
  });
});

describe('contract admin.tours', () => {
  it('hai procedure mount đúng chỗ, theo nếp admin.<vùng>.<động từ>', () => {
    expect(contract.admin.tours.list['~orpc'].route).toMatchObject({
      method: 'GET',
      path: '/api/admin/tours',
    });
    expect(contract.admin.tours.setPublished['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/api/admin/tours/{id}/published',
    });
  });

  it('setPublished khai NOT_FOUND và KHÔNG khai mã nào chặn vì có booking', () => {
    // Bất biến F11: tắt đăng một tour đang có booking sống là HỢP LỆ — khách
    // đã mua vẫn đi, tour chỉ thôi được chào bán.
    const errorMap = contract.admin.tours.setPublished['~orpc'].errorMap as Record<
      string,
      { status?: number } | undefined
    >;
    expect(errorMap.NOT_FOUND?.status).toBe(404);
    expect(Object.keys(errorMap)).toEqual(['NOT_FOUND']);
  });

  it('list KHÔNG khai lỗi nghiệp vụ — đọc thuần', () => {
    expect(Object.keys(contract.admin.tours.list['~orpc'].errorMap ?? {})).toEqual([]);
  });
});
