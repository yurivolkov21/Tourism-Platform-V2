import { parseEnv } from './env.js';

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
});
