/** Một ô của dải số liệu. Giá trị ĐÃ ĐỊNH DẠNG XONG ở tầng trang — component
    này không biết tiền tệ, không biết bậc độ khó, chỉ biết in. */
export interface RegionStat {
  value: string;
  label: string;
}

/**
 * Biến thể Signature "stats" — băng TỐI full-bleed trên nền `--region-hero`,
 * hiện chỉ miền Bắc dùng (xem `regionTheme`). Đây là khu duy nhất của trang có
 * SỐ, và nó đứng trước Highlights ở vùng Bắc: mở màn bằng quy mô chuyến đi rồi
 * mới kể chi tiết.
 *
 * ⚠️ Băng này tối ở CẢ HAI theme (`--region-hero` không đổi theo theme), nên chữ
 * dùng `text-on-media` — token CỐ ĐỊNH — chứ KHÔNG `text-foreground`, và cũng
 * KHÔNG bọc class `dark`. Cùng lý lẽ với `region-hero.tsx`.
 *
 * Số liệu vào bằng PROP: chúng dẫn xuất từ chính catalogue của vùng
 * (`regionGlance` + `toursInRegion`), nên thêm/bớt tour là dải số tự đúng theo.
 */
export function RegionSignatureStats({
  eyebrow,
  heading,
  body,
  points,
  stats,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  points: readonly string[];
  stats: RegionStat[];
}) {
  return (
    <section
      style={{ background: 'var(--region-hero)' }}
      className="w-full px-4 py-20 text-on-media md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* Eyebrow dùng `on-media/80` (đo được 10.29:1) chứ KHÔNG `--region-spark`
              như Nexora tô accent: spark của Bắc trên nền hero chỉ 3.34:1 — đủ cho
              chữ ≥24px như `<dt>` bên dưới, KHÔNG đủ cho chữ 12px ở đây. */}
          <p className="font-mono text-xs tracking-widest text-on-media/80 uppercase">{eyebrow}</p>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance md:text-[40px]/12">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-pretty text-on-media/80">{body}</p>

          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  style={{ background: 'var(--region-spark)' }}
                  className="mt-2 size-2 shrink-0 rounded-full"
                />
                <span className="text-pretty">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Vùng chưa có tour nào (nhánh có thật khi gắn API) thì `stats` rỗng —
            bỏ hẳn `<dl>` thay vì in một hàng viền trống. */}
        {stats.length > 0 ? (
          <dl className="mt-14 grid grid-cols-2 gap-8 sm:mt-16 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="border-t border-on-media/15 pt-4">
                {/* `--region-spark` trên `--region-hero` đo được 3.34:1 — dưới
                    ngưỡng 4.5 của chữ thường nhưng ĐẠT ngưỡng 3.0 của chữ lớn, và
                    `text-3xl` = 30px nên nó là chữ lớn. Đừng thu nhỏ cỡ chữ này. */}
                <dt
                  style={{ color: 'var(--region-spark)' }}
                  className="font-heading text-3xl font-semibold tabular-nums sm:text-4xl"
                >
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm text-pretty text-on-media/80">{stat.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
