import { contract } from '../contract.js';
import {
  AdminDestinationCreateInputSchema,
  AdminDestinationRowSchema,
  AdminDestinationSetActiveInputSchema,
  AdminDestinationUpdateInputSchema,
  DESTINATION_COUNTRY_MAX,
  DESTINATION_DEFAULT_COUNTRY,
  DESTINATION_DESCRIPTION_MAX,
  DESTINATION_NAME_MAX,
  DESTINATION_SLUG_MAX,
} from './admin-destinations.js';

/**
 * Contract `admin.destinations` (spec P4e-2 F15) — bốn thao tác của bảng điểm
 * đến: đọc, tạo, sửa, ẩn/hiện. Không xoá (spec §2a), không sắp thứ tự (bảng
 * này không có cột `order`).
 *
 * Hai bất biến đắt nhất của cả phase hiện ra ở đây:
 *
 * - `update` KHÔNG mang `slug` — slug đi vào `/tours?destinations=<slug>`, mà
 *   tham số truy vấn thì không chuyển hướng được (spec §2c).
 * - `region` ghi qua `RegionNameSchema`, không phải chữ tự do — một lần gõ
 *   nhầm là điểm đến biến khỏi mọi trang vùng mà không có lỗi nào (spec §2b,
 *   ADR-0045).
 */

const ID = '4f1b1f2e-0000-4000-8000-000000000002';

const ROW = {
  id: ID,
  slug: 'hoi-an',
  name: 'Hội An',
  country: 'Vietnam',
  region: 'Central Vietnam',
  description: 'Lanterns, tailors and the old port.',
  isActive: true,
  tourCount: 4,
};

describe('AdminDestinationRowSchema', () => {
  it('nhận một hàng đầy đủ', () => {
    expect(AdminDestinationRowSchema.safeParse(ROW).success).toBe(true);
  });

  it('hàng ĐÃ ẨN vẫn đọc được — bảng admin nhìn thấy cả hai trạng thái', () => {
    expect(AdminDestinationRowSchema.safeParse({ ...ROW, isActive: false }).success).toBe(true);
  });

  it('`region` là giá trị THÔ trong DB — null hay chuỗi kiểu cũ vẫn đọc được', () => {
    // Cổng chặt nằm ở input. Output mà chặt thì một hàng kiểu cũ (`north`,
    // hay `null` từ thời seed) làm cả bảng sập 500 — đúng lúc admin cần mở nó
    // ra để sửa. Chọn sẵn ô vùng từ chuỗi thô là việc của `findRegion`.
    expect(AdminDestinationRowSchema.safeParse({ ...ROW, region: null }).success).toBe(true);
    expect(AdminDestinationRowSchema.safeParse({ ...ROW, region: 'north' }).success).toBe(true);
  });

  it('`description` null được, `tourCount` không âm', () => {
    expect(AdminDestinationRowSchema.safeParse({ ...ROW, description: null }).success).toBe(true);
    expect(AdminDestinationRowSchema.safeParse({ ...ROW, tourCount: -1 }).success).toBe(false);
  });
});

describe('AdminDestinationCreateInputSchema', () => {
  const BASE = { name: 'Hội An', slug: 'hoi-an', region: 'Central Vietnam' };

  it('input tối thiểu hợp lệ: tên, slug, vùng', () => {
    expect(AdminDestinationCreateInputSchema.safeParse(BASE).success).toBe(true);
  });

  it('`country` bỏ trống thì mặc định Vietnam — gương `@default("Vietnam")` của cột', () => {
    expect(AdminDestinationCreateInputSchema.parse(BASE).country).toBe(DESTINATION_DEFAULT_COUNTRY);
    expect(DESTINATION_DEFAULT_COUNTRY).toBe('Vietnam');
  });

  it('`country` toàn khoảng trắng bị chặn, không thành chuỗi rỗng trong DB', () => {
    expect(AdminDestinationCreateInputSchema.safeParse({ ...BASE, country: '   ' }).success).toBe(
      false,
    );
  });

  it('`region` chỉ nhận ba tên vùng — từ chối chuỗi lạ và cả khoá ngắn', () => {
    // `north` web đọc được (luật đọc rộng), nhưng admin không được GHI nó:
    // ADR-0045 chốt lưu `name`, khớp 18 hàng đang có.
    for (const region of ['North', 'north', 'Mekong', '']) {
      expect(AdminDestinationCreateInputSchema.safeParse({ ...BASE, region }).success, region).toBe(
        false,
      );
    }
    expect(
      AdminDestinationCreateInputSchema.safeParse({ ...BASE, region: 'Southern Vietnam' }).success,
    ).toBe(true);
  });

  it('thiếu `region` là hỏng — không có vùng thì điểm đến không có trang nào để hiện', () => {
    expect(
      AdminDestinationCreateInputSchema.safeParse({ name: BASE.name, slug: BASE.slug }).success,
    ).toBe(false);
  });

  it('slug dùng CHUNG khuôn với danh mục: gạch nối chỉ nằm giữa hai cụm chữ-số', () => {
    for (const slug of ['-', '---', '-hoi-an', 'hoi-an-', 'hoi--an', 'Hoi An', 'hoi_an', '']) {
      expect(AdminDestinationCreateInputSchema.safeParse({ ...BASE, slug }).success, slug).toBe(
        false,
      );
    }
    // Mười tám slug đang chạy trên production (seed 18/09) đều phải qua.
    for (const slug of [
      'hanoi',
      'ha-long',
      'cat-ba',
      'sa-pa',
      'ninh-binh',
      'ha-giang',
      'mai-chau',
      'hue',
      'hoi-an',
      'da-nang',
      'phong-nha',
      'quy-nhon',
      'ho-chi-minh-city',
      'vung-tau',
      'can-tho',
      'ben-tre',
      'da-lat',
      'phu-quoc',
    ]) {
      expect(AdminDestinationCreateInputSchema.safeParse({ ...BASE, slug }).success, slug).toBe(
        true,
      );
    }
  });

  it('trần cột gương đúng độ rộng DB', () => {
    const qua = (n: number) => 'a'.repeat(n);
    const hong = (over: Record<string, unknown>) =>
      AdminDestinationCreateInputSchema.safeParse({ ...BASE, ...over }).success;

    expect(hong({ slug: qua(DESTINATION_SLUG_MAX) })).toBe(true);
    expect(hong({ slug: qua(DESTINATION_SLUG_MAX + 1) })).toBe(false);
    expect(hong({ name: qua(DESTINATION_NAME_MAX + 1) })).toBe(false);
    expect(hong({ country: qua(DESTINATION_COUNTRY_MAX + 1) })).toBe(false);
    expect(hong({ description: qua(DESTINATION_DESCRIPTION_MAX) })).toBe(true);
    expect(hong({ description: qua(DESTINATION_DESCRIPTION_MAX + 1) })).toBe(false);
  });

  it('ba con số trần là số của cột, không phải số đoán', () => {
    expect([DESTINATION_SLUG_MAX, DESTINATION_NAME_MAX, DESTINATION_COUNTRY_MAX]).toEqual([
      80, 120, 60,
    ]);
    expect(DESTINATION_DESCRIPTION_MAX).toBe(2000);
  });

  it('mô tả RỖNG hoặc toàn khoảng trắng thành `null`, không thành chuỗi rỗng', () => {
    // Bài học 7 của F14: `.nullable().default(null)` suông thì chuỗi rỗng vẫn
    // lọt vào cột nullable, và `?? 'No description'` không cứu được.
    const parse = (description: unknown) =>
      AdminDestinationCreateInputSchema.parse({ ...BASE, description }).description;

    expect(parse('')).toBeNull();
    expect(parse('   ')).toBeNull();
    expect(parse(undefined)).toBeNull();
    expect(parse('  Lanterns.  ')).toBe('Lanterns.');
  });

  it('tên chỉ toàn khoảng trắng bị chặn, và được cắt khoảng trắng hai đầu', () => {
    expect(AdminDestinationCreateInputSchema.safeParse({ ...BASE, name: '   ' }).success).toBe(
      false,
    );
    expect(AdminDestinationCreateInputSchema.parse({ ...BASE, name: '  Hội An ' }).name).toBe(
      'Hội An',
    );
  });
});

describe('AdminDestinationUpdateInputSchema — slug khoá sau khi tạo', () => {
  const FULL = {
    id: ID,
    name: 'Hội An',
    country: 'Vietnam',
    region: 'Central Vietnam',
    description: null,
  };

  it('nhận id, tên, quốc gia, vùng, mô tả', () => {
    expect(AdminDestinationUpdateInputSchema.safeParse(FULL).success).toBe(true);
  });

  it('gửi kèm `slug` thì nó bị BỎ — server không bao giờ nhìn thấy', () => {
    // Repo không dùng `.strict()`, nên khoá thừa vẫn `success`; điều đáng
    // canh là `parsed.data` KHÔNG mang nó.
    const parsed = AdminDestinationUpdateInputSchema.safeParse({ ...FULL, slug: 'hacked' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && 'slug' in parsed.data).toBe(false);
  });

  it('đổi vùng được — nhưng vẫn chỉ trong ba vùng', () => {
    expect(
      AdminDestinationUpdateInputSchema.safeParse({ ...FULL, region: 'Northern Vietnam' }).success,
    ).toBe(true);
    expect(AdminDestinationUpdateInputSchema.safeParse({ ...FULL, region: 'Mekong' }).success).toBe(
      false,
    );
  });

  it('`country` BẮT BUỘC ở lệnh sửa — không lặng lẽ ghi đè về Vietnam', () => {
    // Mặc định chỉ có nghĩa lúc TẠO. Ở lệnh sửa, một client quên gửi ô này mà
    // schema tự điền `Vietnam` là âm thầm đổi dữ liệu người ta không hề chạm.
    const noCountry = { id: FULL.id, name: FULL.name, region: FULL.region, description: null };
    expect(AdminDestinationUpdateInputSchema.safeParse(noCountry).success).toBe(false);
  });

  it('mô tả rỗng thành `null` ở cả lệnh sửa', () => {
    expect(
      AdminDestinationUpdateInputSchema.parse({ ...FULL, description: '  ' }).description,
    ).toBe(null);
  });
});

describe('AdminDestinationSetActiveInputSchema', () => {
  it('nhận cờ boolean, không nhận chuỗi', () => {
    expect(
      AdminDestinationSetActiveInputSchema.safeParse({ id: ID, isActive: false }).success,
    ).toBe(true);
    expect(AdminDestinationSetActiveInputSchema.safeParse({ id: ID, isActive: 'no' }).success).toBe(
      false,
    );
  });
});

describe('contract admin.destinations', () => {
  it('bốn thao tác mounted đúng đường', () => {
    const routes: Array<[{ '~orpc': { route?: { method?: string; path?: string } } }, string]> = [
      [contract.admin.destinations.list, 'GET /api/admin/destinations'],
      [contract.admin.destinations.create, 'POST /api/admin/destinations'],
      [contract.admin.destinations.update, 'POST /api/admin/destinations/{id}'],
      [contract.admin.destinations.setActive, 'POST /api/admin/destinations/{id}/active'],
    ];
    for (const [procedure, expected] of routes) {
      const route = procedure['~orpc'].route;
      expect(`${route?.method} ${route?.path}`).toBe(expected);
    }
  });

  it('KHÔNG có lệnh xoá, KHÔNG có lệnh sắp thứ tự', () => {
    // Xoá: spec §2a — khoá ngoại `tour_destinations` khai `ON DELETE CASCADE`,
    // tức một lệnh xoá sẽ âm thầm gỡ điểm đến khỏi mọi tour. Sắp: bảng này
    // không có cột `order`.
    expect(Object.keys(contract.admin.destinations).sort()).toEqual([
      'create',
      'list',
      'setActive',
      'update',
    ]);
  });

  it('`SLUG_TAKEN` là 409 và CHỈ `create` khai nó', () => {
    const errorMap = (procedure: { '~orpc': { errorMap: object } }) =>
      procedure['~orpc'].errorMap as Record<string, { status?: number }>;

    expect(errorMap(contract.admin.destinations.create).SLUG_TAKEN?.status).toBe(409);
    expect('SLUG_TAKEN' in errorMap(contract.admin.destinations.update)).toBe(false);
  });

  it('mọi lệnh ghi theo id đều khai NOT_FOUND 404, còn `list` không khai mã nào', () => {
    for (const procedure of [
      contract.admin.destinations.update,
      contract.admin.destinations.setActive,
    ]) {
      const errorMap = procedure['~orpc'].errorMap as Record<string, { status?: number }>;
      expect(errorMap.NOT_FOUND?.status).toBe(404);
    }
    expect(Object.keys(contract.admin.destinations.list['~orpc'].errorMap)).toEqual([]);
  });

  it('tập mã của mỗi procedure đúng như spec §3', () => {
    const codes = (procedure: { '~orpc': { errorMap: object } }) =>
      Object.keys(procedure['~orpc'].errorMap).sort();

    expect(codes(contract.admin.destinations.create)).toEqual(['SLUG_TAKEN']);
    expect(codes(contract.admin.destinations.update)).toEqual(['NOT_FOUND']);
    expect(codes(contract.admin.destinations.setActive)).toEqual(['NOT_FOUND']);
  });
});
