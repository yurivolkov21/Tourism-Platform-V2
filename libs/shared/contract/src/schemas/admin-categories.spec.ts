import { contract } from '../contract.js';
import {
  AdminCategoryCreateInputSchema,
  AdminCategoryMoveInputSchema,
  AdminCategoryRowSchema,
  AdminCategorySetActiveInputSchema,
  AdminCategoryUpdateInputSchema,
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  CATEGORY_SLUG_MAX,
} from './admin-categories.js';

/**
 * Contract `admin.categories` (spec P4e-2 F14) — năm thao tác của bảng danh mục.
 *
 * Bộ test này canh những ràng buộc mà CHỈ schema quan sát được, và một bất biến
 * của cả phase: `update` KHÔNG mang `slug`. Slug đi vào URL công khai dạng tham
 * số truy vấn (`/tours?categories=<slug>`), mà tham số truy vấn thì không
 * chuyển hướng được — nên nó khoá sau khi tạo (spec §2c).
 */

const ID = '4f1b1f2e-0000-4000-8000-000000000001';

const ROW = {
  id: ID,
  slug: 'day-trips',
  name: 'Day trips',
  description: 'One day, back by dinner.',
  order: 1,
  isActive: true,
  tourCount: 7,
};

describe('AdminCategoryRowSchema', () => {
  it('nhận một hàng đầy đủ', () => {
    expect(AdminCategoryRowSchema.safeParse(ROW).success).toBe(true);
  });

  it('`description` null được — cột DB nullable, API trả null tường minh', () => {
    expect(AdminCategoryRowSchema.safeParse({ ...ROW, description: null }).success).toBe(true);
  });

  it('hàng ĐÃ TẮT vẫn đọc được — bảng admin nhìn thấy cả hai trạng thái', () => {
    // Khác endpoint công khai, vốn chỉ trả hàng đang bật.
    expect(AdminCategoryRowSchema.safeParse({ ...ROW, isActive: false }).success).toBe(true);
  });

  it('`tourCount` không âm', () => {
    expect(AdminCategoryRowSchema.safeParse({ ...ROW, tourCount: -1 }).success).toBe(false);
  });
});

describe('AdminCategoryCreateInputSchema', () => {
  const BASE = { name: 'Day trips', slug: 'day-trips' };

  it('slug chỉ nhận chữ thường, số và gạch ngang', () => {
    expect(AdminCategoryCreateInputSchema.safeParse({ ...BASE, slug: 'Day Trips' }).success).toBe(
      false,
    );
    expect(AdminCategoryCreateInputSchema.safeParse({ ...BASE, slug: 'day_trips' }).success).toBe(
      false,
    );
    expect(AdminCategoryCreateInputSchema.safeParse({ ...BASE, slug: 'day-trips-2' }).success).toBe(
      true,
    );
  });

  it('slug rỗng bị chặn — `slugifyVietnamese` trả rỗng khi tên toàn ký tự lạ', () => {
    // Đây là đường nối thật giữa hai file: ô slug điền sẵn bằng hàm ấy, và
    // một tên như "!!!" cho ra chuỗi rỗng. Schema phải bắt, không để lọt.
    expect(AdminCategoryCreateInputSchema.safeParse({ ...BASE, slug: '' }).success).toBe(false);
  });

  it('trần cột gương đúng độ rộng DB', () => {
    const qua = (n: number) => 'a'.repeat(n);
    expect(
      AdminCategoryCreateInputSchema.safeParse({ ...BASE, slug: qua(CATEGORY_SLUG_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      AdminCategoryCreateInputSchema.safeParse({ ...BASE, name: qua(CATEGORY_NAME_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      AdminCategoryCreateInputSchema.safeParse({
        ...BASE,
        description: qua(CATEGORY_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it('description bỏ trống thành `null`, không thành chuỗi rỗng', () => {
    // Chuỗi rỗng và "chưa viết mô tả" là hai thứ khác nhau ở cột nullable.
    expect(AdminCategoryCreateInputSchema.parse(BASE).description).toBeNull();
  });

  it('tên chỉ toàn khoảng trắng bị chặn', () => {
    expect(AdminCategoryCreateInputSchema.safeParse({ ...BASE, name: '   ' }).success).toBe(false);
  });
});

describe('AdminCategoryUpdateInputSchema — slug khoá sau khi tạo', () => {
  const FULL = { id: ID, name: 'Day trips', description: null };

  it('nhận id, name, description', () => {
    expect(AdminCategoryUpdateInputSchema.safeParse(FULL).success).toBe(true);
  });

  it('gửi kèm `slug` thì nó bị BỎ — server không bao giờ nhìn thấy', () => {
    // Repo không dùng `.strict()` ở đâu cả (kiểm 22/09), nên input thừa khoá
    // vẫn `success`. Điều đáng canh là `parsed.data` KHÔNG mang khoá ấy: đó
    // mới là thứ ngăn một client bị sửa đổi được slug qua cửa sau.
    const parsed = AdminCategoryUpdateInputSchema.safeParse({ ...FULL, slug: 'hacked' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && 'slug' in parsed.data).toBe(false);
  });
});

describe('AdminCategoryMoveInputSchema', () => {
  it('chỉ nhận hai hướng', () => {
    expect(AdminCategoryMoveInputSchema.safeParse({ id: ID, direction: 'up' }).success).toBe(true);
    expect(AdminCategoryMoveInputSchema.safeParse({ id: ID, direction: 'down' }).success).toBe(
      true,
    );
    expect(AdminCategoryMoveInputSchema.safeParse({ id: ID, direction: 'top' }).success).toBe(
      false,
    );
  });

  it('KHÔNG nhận số thứ tự — client không cần biết `order` đang là bao nhiêu', () => {
    // Nhận số là mở cửa cho hai admin bấm cùng lúc rồi ghi hai hàng cùng số.
    expect(AdminCategoryMoveInputSchema.safeParse({ id: ID, order: 3 }).success).toBe(false);
  });
});

describe('AdminCategorySetActiveInputSchema', () => {
  it('nhận cờ boolean, không nhận chuỗi', () => {
    expect(AdminCategorySetActiveInputSchema.safeParse({ id: ID, isActive: false }).success).toBe(
      true,
    );
    expect(AdminCategorySetActiveInputSchema.safeParse({ id: ID, isActive: 'no' }).success).toBe(
      false,
    );
  });
});

describe('contract admin.categories', () => {
  it('năm thao tác mounted đúng đường', () => {
    const routes: Array<[{ '~orpc': { route?: { method?: string; path?: string } } }, string]> = [
      [contract.admin.categories.list, 'GET /api/admin/categories'],
      [contract.admin.categories.create, 'POST /api/admin/categories'],
      [contract.admin.categories.update, 'POST /api/admin/categories/{id}'],
      [contract.admin.categories.setActive, 'POST /api/admin/categories/{id}/active'],
      [contract.admin.categories.move, 'POST /api/admin/categories/{id}/move'],
    ];
    for (const [procedure, expected] of routes) {
      const route = procedure['~orpc'].route;
      expect(`${route?.method} ${route?.path}`).toBe(expected);
    }
  });

  it('`SLUG_TAKEN` là 409 — thế giới đã đổi, không phải input hỏng', () => {
    const errorMap = contract.admin.categories.create['~orpc'].errorMap as Record<
      string,
      { status?: number }
    >;
    expect(errorMap.SLUG_TAKEN?.status).toBe(409);
  });

  it('`CANNOT_MOVE` là 409 và CHỈ `move` khai nó', () => {
    const move = contract.admin.categories.move['~orpc'].errorMap as Record<
      string,
      { status?: number }
    >;
    const update = contract.admin.categories.update['~orpc'].errorMap as Record<string, unknown>;

    expect(move.CANNOT_MOVE?.status).toBe(409);
    expect('CANNOT_MOVE' in update).toBe(false);
  });

  it('`list` không khai mã lỗi nghiệp vụ nào — đọc cả bảng thì không hỏng được', () => {
    expect(Object.keys(contract.admin.categories.list['~orpc'].errorMap)).toEqual([]);
  });

  it('mọi lệnh ghi theo id đều khai NOT_FOUND', () => {
    for (const procedure of [
      contract.admin.categories.update,
      contract.admin.categories.setActive,
      contract.admin.categories.move,
    ]) {
      const errorMap = procedure['~orpc'].errorMap as Record<string, { status?: number }>;
      expect(errorMap.NOT_FOUND?.status).toBe(404);
    }
  });
});
