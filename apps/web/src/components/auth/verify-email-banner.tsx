'use client';

import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth-client';

const t = messages.authForms.verifyEmail.banner;

/**
 * Dải nhắc verify cho SESSION CŨ chưa verify (siết 20/08): từ đợt siết,
 * signup không phát session và login đòi verified — nên session-chưa-verify
 * chỉ còn là TÀN DƯ tạo trước đó (vd account tester 20/08). Banner này là
 * đường quay lại verify cho họ (ý 2 của user); account mới không bao giờ
 * thấy nó.
 *
 * Island nhỏ đặt ở layout (site) — session null hoặc đã verify thì render
 * null, không tốn một pixel.
 */
export function VerifyEmailBanner() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  if (!user || user.emailVerified) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm text-warning-foreground">
      <span>{t.text}</span>
      <button
        type="button"
        className="font-semibold underline underline-offset-2"
        onClick={() => {
          // OTP cũ chắc chắn quá hạn — gửi mã mới rồi đưa tới trang nhập.
          authClient.emailOtp
            .sendVerificationOtp({ email: user.email, type: 'email-verification' })
            .catch(() => {});
          router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
        }}
      >
        {t.action}
      </button>
    </div>
  );
}
