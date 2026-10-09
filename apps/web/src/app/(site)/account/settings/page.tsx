import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SettingsView } from '@/components/account/settings-view';
import { fetchAccountMe } from '@/lib/api/account';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/settings` — tầng sau của hộ chiếu (spec 2026-08-11 M3; bố cục phương án C của spec
 * 09/10). Trang chỉ gác phiên và đọc hồ sơ (`fetchAccountMe`); hero, hai cột và các thẻ nằm ở
 * `SettingsView`. Logic sửa tại dòng, đổi mật khẩu, tải ảnh và xoá tài khoản không đổi.
 */
export const metadata: Metadata = {
  title: `${messages.passportSettings.title} — Nexora`,
  description: messages.passportSettings.subtitle,
};

export default async function AccountSettingsPage() {
  await requireSession('/account/settings');
  const cookie = (await cookies()).toString();
  const profile = await fetchAccountMe(cookie);
  return <SettingsView profile={profile} />;
}
