import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { ResultScreen } from '@/features/auth/result-screen';

/**
 * Màn kết quả dùng chung (khung 6a, 6b): xác minh email xong, đổi mật khẩu xong.
 *
 * `kind` quyết icon và chữ; mặc định rơi về bản "đã xác minh" để một link cụt
 * vẫn ra một màn có nghĩa thay vì màn trắng. Nút luôn về Sign in — verify KHÔNG
 * tự đăng nhập (ADR-0017 §7c), và đổi mật khẩu thì API đã huỷ mọi phiên, nên
 * bước kế của cả hai đều là đăng nhập lại.
 *
 * Về bằng `dismissTo`, không `replace`: đường Sign in → Verify (và Sign in →
 * Create account → Verify) có Sign in nằm dưới, `replace` dựng thêm một bản chồng
 * lên — back một lần lại ra Sign in (review M1). Đường đặt lại mật khẩu mở từ
 * link email chưa có Sign in nào, `dismissTo` thay màn này bằng Sign in.
 */
export default function SuccessRoute() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const passwordUpdated = params.kind === 'password-updated';
  const copy = passwordUpdated
    ? messages.authForms.resetPassword.toast
    : messages.authForms.verifyEmail.toast;

  return (
    <ResultScreen
      icon={passwordUpdated ? 'key' : 'check'}
      title={copy.title}
      body={copy.body}
      actionLabel={messages.mobile.auth.success.signIn}
      onAction={() => router.dismissTo('/login')}
    />
  );
}
