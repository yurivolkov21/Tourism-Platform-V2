import { messages } from '@tourism/i18n';
import {
  type DeleteAccountAction,
  type DeleteAccountResult,
  submitDeleteAccount,
} from './delete-account-flow';

const danger = messages.accountProfile.danger.errors;

function actionReturning(result: DeleteAccountResult): jest.MockedFunction<DeleteAccountAction> {
  return jest.fn<Promise<DeleteAccountResult>, [string]>().mockResolvedValue(result);
}

describe('submitDeleteAccount', () => {
  it('ô mật khẩu trống thì chặn ở máy, không gọi API', async () => {
    const deleteAccount = actionReturning({ ok: true });

    const outcome = await submitDeleteAccount('', deleteAccount);

    expect(outcome).toEqual({
      kind: 'fieldError',
      text: messages.formErrors.password.required,
    });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('thành công thì trả done và gửi đúng mật khẩu', async () => {
    const deleteAccount = actionReturning({ ok: true });

    const outcome = await submitDeleteAccount('secret-123', deleteAccount);

    expect(outcome).toEqual({ kind: 'done' });
    expect(deleteAccount).toHaveBeenCalledWith('secret-123');
  });

  it('INVALID_PASSWORD rơi về ô mật khẩu, không lên khung form', async () => {
    const outcome = await submitDeleteAccount(
      'sai',
      actionReturning({ ok: false, status: 403, code: 'INVALID_PASSWORD' }),
    );

    expect(outcome).toEqual({ kind: 'fieldError', text: danger.wrongPassword });
  });

  it('401 (phiên hết hạn giữa chừng) báo sessionExpired, bất kể code', async () => {
    const outcome = await submitDeleteAccount(
      'secret-123',
      actionReturning({ ok: false, status: 401, code: 'UNAUTHORIZED' }),
    );

    expect(outcome).toEqual({
      kind: 'formError',
      text: messages.accountActionErrors.sessionExpired,
    });
  });

  it.each([
    ['ACCOUNT_HAS_PAID_BOOKINGS', 409, danger.paidBookings],
    ['ACCOUNT_HAS_PENDING_CHECKOUT', 409, danger.pendingCheckout],
    ['ACCOUNT_HAS_OPEN_CANCELLATION', 409, danger.openCancellation],
    ['CREDENTIAL_ACCOUNT_NOT_FOUND', 409, danger.noPassword],
    ['TOO_MANY_ATTEMPTS', 429, danger.tooManyAttempts],
  ])('mã %s lên khung form với copy riêng', async (code, status, text) => {
    const outcome = await submitDeleteAccount(
      'secret-123',
      actionReturning({ ok: false, status, code }),
    );

    expect(outcome).toEqual({ kind: 'formError', text });
  });

  it('429 không mang code (trần throttle chung) dùng copy throttle', async () => {
    const outcome = await submitDeleteAccount(
      'secret-123',
      actionReturning({ ok: false, status: 429 }),
    );

    expect(outcome).toEqual({ kind: 'formError', text: messages.accountActionErrors.throttle });
  });

  it('mã lạ / mất mạng (status 0) rơi về generic', async () => {
    for (const result of [
      { ok: false, status: 500, code: 'WHATEVER' },
      { ok: false, status: 0 },
    ] as const) {
      const outcome = await submitDeleteAccount('secret-123', actionReturning(result));
      expect(outcome).toEqual({
        kind: 'formError',
        text: messages.accountActionErrors.generic,
      });
    }
  });
});
