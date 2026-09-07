import {
  AdminPageQuerySchema,
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
