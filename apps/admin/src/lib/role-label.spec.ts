import { describe, expect, it } from 'vitest';
import { roleLabel } from './role-label';

describe('roleLabel', () => {
  it('ba role có nhãn — ADMIN in là Owner', () => {
    expect(roleLabel('ADMIN')).toBe('Owner');
    expect(roleLabel('STAFF')).toBe('Staff');
    expect(roleLabel('CUSTOMER')).toBe('Customer');
  });

  it('role lạ in nguyên chữ thay vì ô trống', () => {
    expect(roleLabel('MODERATOR')).toBe('MODERATOR');
  });
});
