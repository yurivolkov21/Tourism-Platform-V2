import { messages } from '@tourism/i18n';
import { Separator } from '@tourism/ui/components/separator';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { DeleteAccount } from '@/components/account/delete-account';
import { ProfileSummary } from '@/components/account/profile-summary';
import { ContentHero } from '@/components/content/content-hero';
import { PassportPaper } from '@/components/passport/passport-paper';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/settings` — tầng sau của hộ chiếu (spec 2026-08-11, M3; dựng lại
 * vòng 3 theo góp ý user 11/08):
 *
 * - Mở bằng `ContentHero` chuẩn site (title/subtitle của trang nằm ở hero,
 *   thân trang không lặp lại).
 * - Thân theo bộ xương shadcn-studio `form-layout-02` user chỉ định
 *   (playground.md): mỗi nhóm là MỘT lưới `md:grid-cols-3 gap-10` — legend +
 *   mô tả chiếm cột trái, nội dung chiếm 2 cột phải, hai bên thẳng hàng vì
 *   CÙNG một grid (khác bản hai-cột cũ bị chê lệch); các nhóm ngăn bằng
 *   `Separator`. Logic (`ProfileSummary` nở-inline, `DeleteAccount` dialog)
 *   không đổi một dòng.
 */
export const metadata: Metadata = {
  title: `${messages.passportSettings.title} — Tourism`,
  description: messages.passportSettings.subtitle,
  robots: { index: false },
};

export default async function AccountSettingsPage() {
  await requireSession('/account/settings');
  const cookie = (await cookies()).toString();
  const profile = await fetchAccountMe(cookie);

  const t = messages.accountProfile;
  const tp = messages.passportSettings;

  return (
    <div>
      <ContentHero breadcrumb={tp.heroBreadcrumb} title={tp.title} subtitle={tp.subtitle} />
      <PassportPaper>
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
          <Link
            href="/account"
            className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {tp.back}
          </Link>

          {/* ── Nhóm 1: Personal information ─────────────────────────────── */}
          <section className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-3">
            <div>
              <h2 className="mb-1.5 font-heading text-lg font-semibold">{t.details.heading}</h2>
              <p className="text-sm text-muted-foreground">{t.details.blurb}</p>
            </div>
            <div className="md:col-span-2">
              <ProfileSummary profile={profile} />
            </div>
          </section>

          <Separator className="my-10" />

          {/* ── Nhóm 2: Connected accounts ───────────────────────────────── */}
          <section className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-3">
            <div>
              <h2 className="mb-1.5 font-heading text-lg font-semibold">{t.connected.heading}</h2>
              <p className="text-sm text-muted-foreground">{t.connected.subtitle}</p>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-baseline justify-between gap-6 py-4">
                <span className="text-sm font-medium text-foreground">
                  {t.connected.emailPassword}
                </span>
                <span className="truncate text-sm text-muted-foreground">{profile.email}</span>
              </div>
            </div>
          </section>

          {/* Xoá tài khoản đứng CUỐI — component tự mang divider trên
              (border-t) + heading/mô tả; không thêm Separator kẻo hai vạch
              chồng nhau, và không ép vào lưới 3 cột để hành động nguy hiểm
              không đứng ngang hàng một form thường. */}
          <DeleteAccount />
        </div>
      </PassportPaper>
    </div>
  );
}
