import { parseCommaList, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults on empty input', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('coerces PORT from string', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/Invalid environment/);
  });

  it('rejects non-postgres DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://nope' })).toThrow(/DATABASE_URL/);
  });

  it('defaults Better Auth fields outside production', () => {
    const env = parseEnv({});
    expect(env.BETTER_AUTH_SECRET).toBe('dev-secret-change-me');
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:3001');
    expect(env.ADMIN_EMAILS).toBe('admin@tourism.test');
    expect(env.TRUSTED_ORIGINS).toBe('http://localhost:3000,http://localhost:3002');
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('requires a real BETTER_AUTH_SECRET in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'dev-secret-change-me' }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(
      parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'real-secret' }).BETTER_AUTH_SECRET,
    ).toBe('real-secret');
  });

  it('rejects invalid BETTER_AUTH_URL', () => {
    expect(() => parseEnv({ BETTER_AUTH_URL: 'not a url' })).toThrow(/BETTER_AUTH_URL/);
  });

  it('accepts Google OAuth pair when provided', () => {
    const env = parseEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(env.GOOGLE_CLIENT_SECRET).toBe('secret');
  });
});

describe('parseCommaList', () => {
  it('splits, trims and drops empties', () => {
    expect(parseCommaList(' a@x.io , b@y.io ,, ')).toEqual(['a@x.io', 'b@y.io']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCommaList('')).toEqual([]);
  });
});
