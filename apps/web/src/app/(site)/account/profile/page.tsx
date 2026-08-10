import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { DangerZone } from '@/components/account/danger-zone';
import { ProfileSummary } from '@/components/account/profile-summary';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/profile` — hợp nhất tên/phone + đổi mật khẩu + connected
 * accounts + danger-zone (spec §3, Task 6/A2: session thật thay
 * mock nội bộ cụm đã khai tử). Avatar chữ-cái tĩnh + email read-only (PARK spec §4 —
 * upload avatar/đổi email chưa làm, có hồ sơ lý do trong spec).
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
    <div className="flex flex-col gap-8">
      {/* Mockup redesign bỏ avatar khỏi trang này: nó chỉ là chữ cái đầu tên
          (chưa có upload ảnh) nên không mang thêm thông tin gì, mà lại chiếm
          đúng chỗ dễ nhìn nhất của trang. Vẫn còn ở navbar cho việc nhận diện. */}
      <div>
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {t.title}
        </h1>
        <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
      </div>

      <ProfileSummary profile={profile} />

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-heading text-lg font-medium text-foreground">{t.connected.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.connected.subtitle}</p>
        {/* Chỉ email/password (không có OAuth demo trong seed dev) — danh
            sách provider thật từ Better Auth/session, có thể nhiều dòng hơn
            một khi Google OAuth bật (Task 7+ nếu cần). */}
        <ul className="mt-4 flex flex-col gap-2">
          <li className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
            <span className="text-foreground">{t.connected.emailPassword}</span>
            <span className="text-muted-foreground">{profile.email}</span>
          </li>
        </ul>
      </section>

      <DangerZone />
    </div>
  );
}
