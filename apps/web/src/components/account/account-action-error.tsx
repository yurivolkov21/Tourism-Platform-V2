import { messages } from '@tourism/i18n';
import type { ReactNode } from 'react';

/**
 * Dòng báo lỗi cho hành động trong khu account.
 *
 * Gom lại vì khối này đang được chép NGUYÊN VĂN ở bốn chỗ (`profile-form`,
 * `change-password-form`, `delete-account`, `booking-actions`). Bốn bản sao nghĩa
 * là mỗi lần đổi cách trình bày lỗi phải sửa bốn nơi, và chỉ cần quên một là
 * chúng lệch nhau — thứ không ai phát hiện cho tới khi gặp đúng nhánh lỗi đó.
 *
 * `redirectTo` KHÁC nhau theo từng chỗ (trang profile vs trang chi tiết
 * booking), nên nó là tham số chứ không phải hằng — đây là điểm dễ gom ẩu
 * thành một giá trị cứng rồi đẩy khách về sai trang sau khi đăng nhập lại.
 *
 * Session hết hạn GIỮA CHỪNG có UI riêng — báo + link đăng nhập lại, KHÔNG tự
 * đăng xuất — vì khách đang làm dở một việc, đá họ ra là mất thao tác.
 */
export function AccountActionError({
  expired,
  redirectTo,
  fallback,
  className,
}: {
  expired: boolean;
  redirectTo: string;
  /** Nội dung khi KHÔNG phải lỗi session — mỗi màn có bộ copy riêng. */
  fallback: ReactNode;
  /** Khoảng cách thêm, ví dụ `mt-3` ở trang chi tiết booking. */
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`text-sm text-destructive-emphasis${className ? ` ${className}` : ''}`}
    >
      {expired ? (
        <>
          {messages.accountActionErrors.sessionExpired}{' '}
          <a href={`/login?redirect=${redirectTo}`} className="underline">
            {messages.accountActionErrors.loginLink}
          </a>
        </>
      ) : (
        fallback
      )}
    </p>
  );
}
