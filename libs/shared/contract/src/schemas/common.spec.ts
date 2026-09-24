import {
  AdminPageQuerySchema,
  descriptionSchema,
  PageQuerySchema,
  SearchQuerySchema,
  sortQuerySchema,
} from './common.js';

describe('PageQuerySchema', () => {
  it('applies defaults', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects page below 1', () => {
    expect(PageQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects pageSize above 100', () => {
    expect(PageQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('PageQuerySchema / AdminPageQuerySchema — trần page (W4 R3)', () => {
  it('page vượt 10 000 → 400 ở validate; 10 000 vẫn hợp lệ', () => {
    expect(PageQuerySchema.parse({ page: 10_000 }).page).toBe(10_000);
    expect(PageQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
    expect(AdminPageQuerySchema.parse({ page: 10_000 }).page).toBe(10_000);
    expect(AdminPageQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
  });
});

describe('sortQuerySchema', () => {
  const schema = sortQuerySchema(['createdAt', 'rating'] as const);

  it('defaults to first key, desc', () => {
    expect(schema.parse({})).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('rejects unknown sort key', () => {
    expect(schema.safeParse({ sortBy: 'nope' }).success).toBe(false);
  });
});

describe('SearchQuerySchema', () => {
  it('trims and allows absent', () => {
    expect(SearchQuerySchema.parse({ search: '  hoi an  ' }).search).toBe('hoi an');
    expect(SearchQuerySchema.parse({}).search).toBeUndefined();
  });
});

describe('descriptionSchema — ô mô tả tự do, RỖNG thì thành null', () => {
  // Bài học 7 của vòng review F14: `.nullable().default(null)` suông thì chuỗi
  // rỗng vẫn lọt xuống cột nullable, và `?? 'No description'` không cứu được
  // (chuỗi rỗng không nullish). Hai bảng dùng chung một bản, khác mỗi trần.
  const schema = descriptionSchema(10);

  it('rỗng hoặc toàn khoảng trắng thành `null`', () => {
    expect(schema.parse('')).toBeNull();
    expect(schema.parse('   ')).toBeNull();
    expect(schema.parse(null)).toBeNull();
  });

  it('mô tả thật thì giữ, đã cắt khoảng trắng hai đầu', () => {
    expect(schema.parse('  Lanterns ')).toBe('Lanterns');
  });

  it('trần tính SAU khi cắt khoảng trắng, và do chỗ gọi truyền vào', () => {
    expect(schema.safeParse(`  ${'a'.repeat(10)}  `).success).toBe(true);
    expect(schema.safeParse('a'.repeat(11)).success).toBe(false);
  });

  it('`undefined` KHÔNG tự thành null — lệnh sửa phải gửi ô này tường minh', () => {
    // Lệnh tạo tự thêm `.default(null)`; lệnh sửa thì không, vì một client
    // quên gửi ô mô tả không được lặng lẽ xoá mô tả đang có.
    expect(schema.safeParse(undefined).success).toBe(false);
  });
});
