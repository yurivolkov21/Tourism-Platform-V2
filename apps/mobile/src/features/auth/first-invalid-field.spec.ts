import { firstInvalidField } from './first-invalid-field';

describe('firstInvalidField', () => {
  it('trả ô sai đứng trước trong thứ tự hiển thị', () => {
    expect(firstInvalidField({ password: 'sai' }, ['email', 'password'])).toBe('password');
    expect(firstInvalidField({ email: 'sai', password: 'sai' }, ['email', 'password'])).toBe(
      'email',
    );
  });

  it('theo THỨ TỰ HIỂN THỊ chứ không theo thứ tự khoá trong object', () => {
    expect(firstInvalidField({ password: 'sai', name: 'sai' }, ['name', 'email', 'password'])).toBe(
      'name',
    );
  });

  it('không có lỗi thì không nhảy đi đâu', () => {
    expect(firstInvalidField({}, ['email', 'password'])).toBeNull();
  });
});
