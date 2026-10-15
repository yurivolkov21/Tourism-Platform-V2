import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { ResultScreen } from '@/features/auth/result-screen';

/**
 * Màn kết quả sau khi đổi mật khẩu ở A6 (N8 nửa sau, 15/10). Trước đây lưu xong là màn đóng về
 * Account không một lời vì app chưa có toast; nay A6 `replace` sang đây.
 *
 * Dùng lại `ResultScreen` của cụm auth (khung 6b) nhưng KHÔNG đi qua `(auth)/success`: route đó
 * nằm trong modal của nhóm auth và nút của nó dẫn tới Sign in, còn ở đây khách vẫn đăng nhập trên
 * máy này. Nút dùng `dismissTo` (cùng khuôn B8) để lùi về bộ tab đang có thay vì dựng thêm một
 * bộ; back cứng và vuốt lùi cũng về Account vì màn form đã bị thay chỗ.
 */
export default function PasswordUpdatedRoute() {
  const copy = messages.mobile.account.password.done;

  return (
    <ResultScreen
      icon="key"
      title={copy.title}
      body={copy.body}
      actionLabel={copy.action}
      onAction={() => router.dismissTo('/account')}
    />
  );
}
