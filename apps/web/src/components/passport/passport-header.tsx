import { messages } from '@tourism/i18n';
import Link from 'next/link';

/**
 * Header trang hộ chiếu (M1/M4): tên serif + "traveler since" + dòng
 * MRZ trang trí + link ⚙ Settings. RSC thuần — mọi dữ liệu đã tính sẵn ở page
 * (memberNo/mrz từ `lib/passport`), component chỉ xếp chữ.
 *
 * Texture giấy nằm ở section cha (trang), KHÔNG ở đây — header chỉ lo typo.
 */
export function PassportHeader({
  name,
  sinceYear,
  mrz,
  settingsHref,
}: {
  name: string;
  sinceYear: number;
  mrz: string;
  settingsHref: string;
}) {
  const t = messages.passportHome;
  return (
    <div className="relative">
      {/* Kicker cũ đã dời lên ContentHero (vòng góp ý 11/08) — header giấy
          chỉ còn danh tính, không lặp lại tên khu. */}
      <h1 className="font-heading text-3xl font-semibold text-balance md:text-4xl">{name}</h1>
      <p className="mt-1 text-[12.5px] tracking-[0.16em] text-muted-foreground uppercase">
        {t.since(sinceYear)}
      </p>
      <Link
        href={settingsHref}
        className="absolute top-0 right-0 text-[13px] font-semibold text-primary-emphasis hover:underline"
      >
        {t.settingsLink}
      </Link>
      {/* MRZ: một dòng mono cố định 44 ký tự — cắt bằng overflow, KHÔNG wrap
          (hai dòng MRZ đọc như lỗi in). aria-hidden vì nó là trang trí, mọi
          thông tin thật đã có ở các dòng trên. */}
      <p
        aria-hidden="true"
        className="mt-6 overflow-hidden border-t border-dashed border-border pt-3 font-mono text-xs tracking-[0.2em] whitespace-nowrap text-ink/55"
      >
        {mrz}
      </p>
    </div>
  );
}
