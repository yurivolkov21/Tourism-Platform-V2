import { messages } from '@tourism/i18n';
import type { PassportStamp } from '@/lib/passport';

/**
 * Dãy tem hộ chiếu — mỗi chuyến hoàn thành một tem, tem ghost nét đứt đứng
 * cuối làm lời mời chuyến kế. Xoay/hình dạng đã deterministic từ `lib/passport`
 * (không random trong render); độ lệch là "khuyết tật thủ công" có chủ đích —
 * tem đóng máy thẳng tắp nhìn giả.
 *
 * Từ vòng tu sửa 11/08 tem thật mang thêm lớp mực `.stamp-ink` (multiply +
 * mask nhiễu feTurbulence) — mực thấm giấy, đứt quãng lấm tấm. Hình dạng GIỮ
 * bộ tròn/vuông gốc: bản chữ nhật Schengen đồng loạt đã bị user bác.
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
  }));
  // justify-start: từ addendum §7.4 dãy tem đứng thành KHỐI riêng có heading
  // (không còn nép phải cạnh header như bố cục cũ).
  return (
    <ul className="flex flex-wrap items-start justify-start gap-2">
      {keyed.map((s) => (
        <li
          key={s.key}
          style={{ transform: `rotate(${s.rotationDeg}deg)` }}
          className={`relative flex size-[86px] flex-none flex-col items-center justify-center border-[2.5px] text-center text-ink ${
            s.shape === 'square' ? 'rounded-2xl' : 'rounded-full'
          } ${s.ghost ? 'border-dashed opacity-30' : 'stamp-ink border-ink opacity-85'} ${
            // Tem thứ hai trở đi hơi so le trục dọc — nhịp "đóng tay".
            s.offset ? 'mt-3' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-[3px] border border-dashed border-ink/55 ${
              s.shape === 'square' ? 'rounded-xl' : 'rounded-full'
            }`}
          />
          <span className="px-2 font-heading text-xs leading-tight font-bold tracking-wide">
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
