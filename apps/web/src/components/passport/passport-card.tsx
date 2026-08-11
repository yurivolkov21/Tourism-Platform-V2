import { messages } from '@tourism/i18n';

/**
 * KHUNG HỘ CHIẾU — data page đóng khung (addendum spec §7.4, user duyệt
 * 11/08): thông tin tài khoản đứng ĐẦU trang account, trước mọi phân tích.
 *
 * Giải phẫu theo data page thật, những phần đã qua kiểm duyệt của user:
 * - Viền kép "laminate": border ngoài + hairline lồng cách 5px.
 * - Chân dung chữ nhật DỌC 3:4 (không bao giờ tròn trên giấy tờ) — tạm là
 *   chữ cái đầu; avatar upload đang PARK (spec cụm A §4), có ảnh thật thì
 *   thế vào đúng ô này.
 * - Lưới field nhãn nhỏ uppercase KHÔNG đánh số (bản đánh số đã bị bác).
 * - Dải MRZ TD3 thật nằm TRONG khung ở đáy — đúng vị trí Zone VII.
 *
 * RSC thuần — mọi giá trị (passportNo, mrz) đã tính sẵn ở page.
 */

/** Một ô field kiểu giấy tờ: nhãn tí hon trên, giá trị dưới. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[15px] font-semibold ${mono ? 'font-mono tracking-[0.06em] tabular-nums' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

export function PassportCard({
  name,
  email,
  phone,
  sinceYear,
  passportNo,
  mrz,
}: {
  name: string;
  email: string;
  /** null → ẩn dòng (fetch phụ hỏng hoặc user chưa khai). */
  phone: string | null;
  sinceYear: number;
  /** 'TV214306' — hiển thị tự nhóm 'TV 214 306'. */
  passportNo: string;
  mrz: [string, string];
}) {
  const t = messages.passportHome;
  const noDisplay = `${passportNo.slice(0, 2)} ${passportNo.slice(2, 5)} ${passportNo.slice(5)}`;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Hairline laminate lồng trong — phủ trọn trang dữ liệu như lớp ép
          nhựa thật (đè cả lên dải MRZ là đúng đời). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] z-10 rounded-xl border border-ink/15"
      />
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:gap-7 md:p-7">
        {/* Avatar VUÔNG bo góc kiểu trang profile (góp ý user 11/08 — thay ô
            chân dung 3:4 kiểu giấy tờ); vẫn chữ-cái-đầu chờ cụm avatar upload
            đang PARK. */}
        <div
          aria-hidden="true"
          className="flex size-28 flex-none items-center justify-center rounded-2xl border border-border bg-muted ring-2 ring-ink/10 ring-offset-2 ring-offset-card"
        >
          <span className="font-heading text-5xl font-semibold text-ink/70">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        {/* Zone II/III — lưới field; Name mở đầu, giá trị lớn hơn các field
            còn lại (tên vẫn làm chủ, như bản header được duyệt). */}
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            {t.fieldName}
          </p>
          <h1 className="mt-0.5 truncate font-heading text-2xl font-semibold md:text-3xl">
            {name}
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Field label={t.fieldNo} value={noDisplay} mono />
            <Field label={t.fieldSince} value={String(sinceYear)} mono />
            <Field
              label={`${t.zoneType} · ${t.zoneCode}`}
              value={`${t.zoneTypeValue} · ${t.zoneCodeValue}`}
              mono
            />
            <div className="col-span-2 sm:col-span-2">
              <Field label={t.fieldEmail} value={email} />
            </div>
            {phone ? <Field label={t.fieldPhone} value={phone} /> : null}
          </div>
        </div>
      </div>
      {/* Zone VII — vùng máy đọc ở đáy khung, nền trầm hơn mặt card một bậc
          để tách "vùng máy đọc" khỏi phần nhân thân. Trang trí thuần. */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-t border-border/70 bg-background px-6 py-3 font-mono text-[10.5px] leading-[1.8] tracking-[0.08em] whitespace-nowrap text-ink/70 select-none md:px-7 md:text-[13px] md:tracking-[0.18em]"
      >
        <p>{mrz[0]}</p>
        <p>{mrz[1]}</p>
      </div>
    </article>
  );
}
