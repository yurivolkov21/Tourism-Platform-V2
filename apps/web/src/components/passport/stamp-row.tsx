import { messages } from '@tourism/i18n';
import { Plane } from 'lucide-react';
import type { PassportStamp } from '@/lib/passport';

/**
 * Dãy tem hộ chiếu — dựng theo giải phẫu tem thật (gói tu sửa 11/08):
 *
 * - Tem chuyến đã đi = CHỮ NHẬT bo góc kiểu Schengen, pictogram máy bay góc
 *   trên phải (quy ước phương tiện của mộc biên phòng thật).
 * - Tem ghost = OVAL nét đứt — "oval cho nhập cảnh": lời mời chuyến kế.
 * - Mực qua `.stamp-ink` (multiply + mask nhiễu feTurbulence) — mực thấm
 *   giấy, đứt quãng lấm tấm, không đều tăm tắp.
 * - Đóng CHỒNG MÉP lên nhau (âm margin) + xoay lệch mỗi tem một góc
 *   deterministic từ `lib/passport` — tem thật chen chúc, không xếp lưới.
 */
export function StampRow({ stamps }: { stamps: PassportStamp[] }) {
  const t = messages.passportHome;
  // Khoá render: hai chuyến trùng nơi + tháng là dữ liệu hợp lệ nên không có
  // khoá tự nhiên; đánh số THỨ TỰ trước khi render là an toàn vì dãy tem dựng
  // lại trọn mỗi lần từ mảng đã sort ổn định — không reorder/insert tại chỗ.
  const keyed = stamps.map((s, i) => ({
    ...s,
    key: `${s.label}|${s.month}|${i}`,
    offset: i % 2 === 1,
    overlap: i > 0,
  }));
  return (
    <ul className="flex flex-wrap items-start justify-end max-md:justify-start">
      {keyed.map((s) => (
        <li
          key={s.key}
          style={{ transform: `rotate(${s.rotationDeg}deg)` }}
          className={`relative flex flex-none flex-col items-center justify-center border-[2.5px] px-2 text-center text-ink ${
            s.shape === 'oval'
              ? 'h-[78px] w-[100px] rounded-[50%]'
              : 'h-[72px] w-[106px] rounded-lg'
          } ${s.ghost ? 'border-dashed opacity-30' : 'stamp-ink border-ink opacity-85'} ${
            // Tem thứ hai trở đi hơi so le trục dọc + lấn mép tem trước —
            // nhịp "đóng tay" chen chúc của trang visa thật.
            s.offset ? 'mt-3' : ''
          } ${s.overlap ? '-ml-3' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-[3px] border border-dashed border-ink/55 ${
              s.shape === 'oval' ? 'rounded-[50%]' : 'rounded-md'
            }`}
          />
          {s.ghost ? null : (
            <Plane aria-hidden="true" className="absolute top-1.5 right-2.5 size-3 opacity-70" />
          )}
          <span className="px-1.5 font-heading text-xs leading-tight font-bold tracking-wide">
            {s.ghost ? t.ghostStampLabel : s.label}
          </span>
          <span className="mt-0.5 text-[8.5px] tracking-[0.12em] uppercase">
            {s.ghost ? t.ghostStampSub : s.month}
          </span>
        </li>
      ))}
    </ul>
  );
}
