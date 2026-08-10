import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  AccountRow,
  AccountRows,
  AccountSection,
  AccountSections,
} from '@/components/account/account-section';
import { DeleteAccount } from '@/components/account/delete-account';
import { ProfileSummary } from '@/components/account/profile-summary';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/profile` — hợp nhất tên/phone + đổi mật khẩu + connected
 * accounts + xoá tài khoản (spec §3, Task 6/A2: session thật thay mock nội
 * bộ cụm đã khai tử). Avatar chữ-cái tĩnh + email read-only (PARK spec §4 —
 * upload avatar/đổi email chưa làm, có hồ sơ lý do trong spec).
 *
 * Task 8: xoá tài khoản không còn là một `AccountSection` ngang hàng —
 * `DeleteAccount` đứng CUỐI, ngoài `AccountSections`, xem comment tại chỗ
 * dùng.
 */
export const metadata: Metadata = {
  title: `${messages.accountProfile.title} — Tourism`,
  description: messages.accountProfile.subtitle,
  robots: { index: false },
};

/**
 * `requireSession` gate (defense-in-depth, ADR-0017 §3) — kết quả KHÔNG dùng
 * trực tiếp cho form: hồ sơ hiển thị đọc riêng từ `GET /api/account/me`
 * (`fetchAccountMe`, cùng khuôn "content fetch song song với gate" như các
 * trang khác đọc `bookings.mine`/`wishlist.list` sau khi gate). Hai fetch
 * chạy `Promise.all` trên CÙNG cookie forward.
 */
export default async function AccountProfilePage() {
  await requireSession('/account/profile');
  const cookie = (await cookies()).toString();
  const profile = await fetchAccountMe(cookie);

  const t = messages.accountProfile;

  return (
    <div>
      {/* Mockup redesign bỏ avatar khỏi trang này: nó chỉ là chữ cái đầu tên
          (chưa có upload ảnh) nên không mang thêm thông tin gì, mà lại chiếm
          đúng chỗ dễ nhìn nhất của trang. Vẫn còn ở navbar cho việc nhận diện. */}
      <h1 className="font-heading text-2xl font-medium text-balance text-foreground">{t.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

      <div className="mt-2">
        <AccountSections>
          <AccountSection title={t.details.heading} description={t.details.blurb}>
            <ProfileSummary profile={profile} />
          </AccountSection>

          <AccountSection title={t.connected.heading} description={t.connected.subtitle}>
            {/* Chỉ email/password (không có OAuth demo trong seed dev) — danh
                sách provider thật từ Better Auth/session, có thể nhiều dòng hơn
                một khi Google OAuth bật (Task 7+ nếu cần). */}
            <AccountRows>
              <AccountRow label={t.connected.emailPassword}>
                <span className="text-muted-foreground">{profile.email}</span>
              </AccountRow>
            </AccountRows>
          </AccountSection>
        </AccountSections>
      </div>

      {/* Xoá tài khoản đứng CUỐI trang, NGOÀI mọi section (Task 8) — không
          còn là một mục "Danger zone" ngang hàng Personal information/
          Connected accounts; component tự lo heading/mô tả/ngăn cách. */}
      <DeleteAccount />
    </div>
  );
}
