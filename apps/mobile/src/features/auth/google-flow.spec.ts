import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { submitGoogle } from './google-flow';
import { createMockAuthActions } from './mock-auth-actions';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });

describe('submitGoogle', () => {
  it('bản giả lập chưa bật Google nên ra khung cấp form', async () => {
    await expect(submitGoogle(actions, 'signIn')).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.notAvailable,
    });
  });

  it('vào được thì báo thành công để route chuyển màn', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({ ok: true });

    await expect(submitGoogle({ ...actions, signInWithGoogle }, 'register')).resolves.toEqual({
      kind: 'success',
    });
  });

  it('lỗi không quy về ô nào vẫn nói ra ở khung cấp form', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({ ok: false, error: 'tooManyRequests' });

    await expect(submitGoogle({ ...actions, signInWithGoogle }, 'signIn')).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.tooManyRequests,
    });
  });
});
