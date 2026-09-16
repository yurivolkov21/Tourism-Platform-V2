import { messages } from '@tourism/i18n';
import { placeAuthError } from './error-channel';

// Luật lỗi ba kênh của spec P5b-1 §5. Một hàm quyết kênh cho MỌI màn, nên hai
// màn không thể nói khác nhau về cùng một mã lỗi.
describe('placeAuthError', () => {
  it('lỗi quy được về ô thì rơi vào kênh 1 (dưới ô)', () => {
    expect(placeAuthError('invalidEmail', 'register')).toEqual({
      channel: 'field',
      field: 'email',
      text: messages.authForms.errors.invalidEmail,
    });
  });

  it('mã OTP sai rơi vào ô nhập mã', () => {
    expect(placeAuthError('invalidOtp', 'verifyEmail')).toMatchObject({
      channel: 'field',
      field: 'otp',
    });
  });

  it('sai thông tin đăng nhập là kênh 2 vì không quy được về ô nào', () => {
    expect(placeAuthError('invalidCredentials', 'signIn')).toEqual({
      channel: 'form',
      text: messages.authForms.errors.invalidCredentials,
    });
  });

  it('thử quá nhiều lần và mất mạng cũng là kênh 2', () => {
    expect(placeAuthError('tooManyRequests', 'verifyEmail')).toMatchObject({ channel: 'form' });
    expect(placeAuthError('generic', 'forgotPassword')).toMatchObject({ channel: 'form' });
  });

  it('link hỏng ở màn đặt lại mật khẩu là kênh 3 (thay cả màn)', () => {
    expect(placeAuthError('invalidToken', 'resetPassword')).toEqual({
      channel: 'screen',
      state: 'invalidLink',
    });
  });

  it('cùng mã đó ở màn khác vẫn là kênh 2 — chỉ màn reset mới hết đường dùng', () => {
    expect(placeAuthError('invalidToken', 'signIn')).toMatchObject({ channel: 'form' });
  });
});
