/**
 * Biến thể Signature "timeline" — ba chặng xếp ngang trên nền phớt màu vùng,
 * hiện chỉ miền Trung dùng. Khác hai biến thể kia ở CẤU TRÚC chứ không chỉ ở màu:
 * đây là thứ tự có hướng, hai kia không.
 *
 * ĐÁNH SỐ ở đây là HỢP LỆ, dù cả cụm destinations có luật "không đánh số vùng":
 * luật đó nói ba vùng không phải các bước tuần tự. Ba chặng này thì có — chúng đi
 * theo trục thời gian/địa lý của con đường di sản, nên con số là thông tin.
 */
export function RegionSignatureTimeline({
  eyebrow,
  heading,
  body,
  timeline,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  timeline: readonly { title: string; era: string; body: string }[];
}) {
  return (
    <section
      style={{ background: 'color-mix(in oklch, var(--region-surface), var(--background) 88%)' }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* Eyebrow là `text-foreground`, KHÔNG `--region-primary` như Nexora tô
              accent: token vùng không đổi theo theme, nên primary của miền Trung
              trên nền phớt này đo được 8.54:1 ở light nhưng **1.31:1 ở dark**.
              Màu vùng ở khu này đi vào HUY HIỆU SỐ, nơi nó làm nền chứ không làm
              chữ — nền thì tương phản với `on-media` là cố định ở cả hai theme. */}
          <p className="font-mono text-xs tracking-widest text-foreground uppercase">{eyebrow}</p>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">{body}</p>
        </div>

        <ol className="mt-16 grid gap-12 sm:mt-20 sm:grid-cols-3 sm:gap-8">
          {timeline.map((stop, i) => (
            <li key={stop.title} className="relative border-t border-border pt-9">
              {/* Huy hiệu ĐẶC (nền màu vùng + chữ `on-media`, đo được 8.54:1 ở cả
                  hai theme), KHÔNG phải huy hiệu viền + chữ màu vùng như Nexora:
                  bản viền đo được 1.69:1 ở dark mode — con số gần như biến mất. */}
              <span
                style={{ background: 'var(--region-primary)' }}
                className="absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full font-heading text-sm font-semibold text-on-media"
              >
                {i + 1}
              </span>
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                {stop.era}
              </span>
              <h3 className="mt-1 font-heading text-2xl font-medium text-foreground">
                {stop.title}
              </h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{stop.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
