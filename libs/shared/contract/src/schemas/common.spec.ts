import { PageQuerySchema, SearchQuerySchema, sortQuerySchema } from './common.js';

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
