import { messages } from '@tourism/i18n';
import Link from 'next/link';

/**
 * Header trang hộ chiếu (M1/M4) — dựng theo giải phẫu data page ICAO 9303
 * (gói tu sửa 11/08):
 *
 * - Hàng Zone I mép trên: Type P · Code TRV · Passport no. — số hộ chiếu in
 *   đậm như hộ chiếu thật (luôn nằm phía phải trên của data page).
 * - Field danh tính mang caption đánh số kiểu ID `(4) NAME` — nhãn tí hon
 *   tracking rộng, giá trị lớn bên dưới (quy ước nhãn ≈ nửa cỡ giá trị của
 *   giấy tờ thật).
 * - Dòng MRZ đã DỜI ra dải riêng đáy section (page lo) — vùng đọc máy của
 *   TD3 nằm cuối trang trên nền trắng trơn, không thuộc khối danh tính.
 *
 * RSC thuần — mọi dữ liệu đã tính sẵn ở page (`lib/passport`), component chỉ
 * xếp chữ. Texture giấy nằm ở section cha, KHÔNG ở đây.
 */

/** Caption đánh số + giá trị — một ô field kiểu giấy tờ. */
function ZoneField({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        ({n}) {label}
      </p>
      <p className="mt-0.5 font-mono text-[13px] font-bold tracking-[0.08em] text-ink">{value}</p>
    </div>
  );
}

export function PassportHeader({
  name,
  sinceYear,
  passportNo,
  settingsHref,
}: {
  name: string;
  sinceYear: number;
  passportNo: string;
  settingsHref: string;
}) {
  const t = messages.passportHome;
  // 'TV214306' → 'TV 214 306' — nhóm số cho mắt như dòng in trên bìa thật.
  const noDisplay = `${passportNo.slice(0, 2)} ${passportNo.slice(2, 5)} ${passportNo.slice(5)}`;
  return (
    <div>
      {/* ── Zone I: hàng giấy tờ mép trên ── */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
        <ZoneField n={1} label={t.zoneType} value={t.zoneTypeValue} />
        <ZoneField n={2} label={t.zoneCode} value={t.zoneCodeValue} />
        <ZoneField n={3} label={t.zoneNo} value={noDisplay} />
        <Link
          href={settingsHref}
          className="ml-auto text-[13px] font-semibold text-primary-emphasis hover:underline"
        >
          {t.settingsLink}
        </Link>
      </div>

      {/* ── Zone II: danh tính ── */}
      <div className="mt-5">
        <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          (4) {t.fieldName}
        </p>
        <h1 className="mt-0.5 font-heading text-3xl font-semibold text-balance md:text-4xl">
          {name}
        </h1>
      </div>
      <div className="mt-3">
        <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          (5) {t.fieldSince}
        </p>
        <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-[0.08em] tabular-nums">
          {sinceYear}
        </p>
      </div>
    </div>
  );
}
