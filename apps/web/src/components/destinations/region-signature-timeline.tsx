import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';

/**
 * Biến thể Signature "timeline" — ba chặng xếp ngang trên băng phớt, hiện chỉ
 * miền Trung dùng. Khác hai biến thể kia ở CẤU TRÚC, và sau ADR-0015 thì CHỈ ở
 * cấu trúc: đây là thứ tự có hướng, hai kia không.
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
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` (quy ước toàn site) thay cho eyebrow `font-mono` tự
              chế port từ Nexora. Nó là `text-foreground`, KHÔNG tô `--primary`
              như Nexora tô accent: primary trên băng phớt này đo được 5.11:1 ở
              light nhưng chỉ 3.03:1 ở dark — dưới ngưỡng 4.5 của chữ nhỏ.
              Accent của khu này đi vào HUY HIỆU SỐ, nơi nó làm NỀN chứ không làm
              chữ. Eyebrow `text-foreground` trên băng đo 12.67:1 light /
              10.65:1 dark. */}
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          {/* Cascade header (Task 5m): tiêu đề → đoạn dẫn. Chỉ trượt `y`, không mờ
              dần — xem `motion/reveal-header.tsx` cho lý do (SSG phải đọc được khi
              JS chưa chạy). Khu này vẫn là Server Component: chỉ component con bên
              dưới mới mang directive client. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {heading}
          </RevealHeading>
          <RevealLede className="mt-2 text-lg text-pretty text-muted-foreground">{body}</RevealLede>
        </div>

        <ol className="mt-16 grid gap-12 sm:mt-20 sm:grid-cols-3 sm:gap-8">
          {timeline.map((stop, i) => (
            <li key={stop.title} className="relative border-t border-border pt-9">
              {/* Huy hiệu ĐẶC (`bg-primary` + `text-primary-foreground`), KHÔNG
                  phải huy hiệu viền + chữ accent như Nexora: bản viền đo được
                  1.69:1 ở dark mode — con số gần như biến mất.
                  Chữ 14px nên ngưỡng là 4.5; đo 5.52:1 light / 4.11:1 dark. Con
                  số dark trượt ngưỡng, nhưng nó ĐÚNG BẰNG cặp mặc định
                  `bg-primary`/`primary-foreground` của toàn repo — nợ đã ghi ở
                  ADR-0015 §Hệ quả, không phải lớp lỗi mới của khu này. */}
              <span className="absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
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
