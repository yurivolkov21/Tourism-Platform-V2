import { isBootstrapAdmin } from './admin-bootstrap.js';

describe('isBootstrapAdmin', () => {
  const admins = ['admin@tourism.test', 'boss@tourism.test'];

  it('matches exact email', () => {
    expect(isBootstrapAdmin('admin@tourism.test', admins)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isBootstrapAdmin('Admin@Tourism.TEST', admins)).toBe(true);
    expect(isBootstrapAdmin('admin@tourism.test', ['ADMIN@TOURISM.TEST'])).toBe(true);
  });

  it('trims whitespace on both sides', () => {
    expect(isBootstrapAdmin('  admin@tourism.test  ', admins)).toBe(true);
    expect(isBootstrapAdmin('admin@tourism.test', [' admin@tourism.test '])).toBe(true);
  });

  it('rejects non-listed email', () => {
    expect(isBootstrapAdmin('user@tourism.test', admins)).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isBootstrapAdmin('admin@tourism.test.evil.com', admins)).toBe(false);
    expect(isBootstrapAdmin('xadmin@tourism.test', admins)).toBe(false);
  });

  it('handles empty inputs', () => {
    expect(isBootstrapAdmin('', admins)).toBe(false);
    expect(isBootstrapAdmin('admin@tourism.test', [])).toBe(false);
  });
});
