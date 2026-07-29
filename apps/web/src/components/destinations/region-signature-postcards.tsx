import { cn } from '@tourism/ui/lib/utils';
import { RegionTile } from '@/components/destinations/region-tile';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';

/**
 * Khu bưu thiếp — ba bưu thiếp dọc so le trên băng phớt, hiện chỉ miền Nam dùng,
 * và ở đó nó là khu MỞ ĐẦU (`regionTheme('south').openWith`). Đây là biến thể
 * DẪN BẰNG ẢNH: miền Nam bán cảnh sông nước, nên nó xứng đáng khu ảnh riêng chứ
 * không phải thêm một khối chữ nữa.
 *
 * `emphasis` DỰNG KHU LỚN HƠN, và lý do nằm ngoài file này: **miền Nam cố ý
 * không có khu chữ ký thứ hai** (Bắc có `seasons`, Trung có `timeline`). Nam
 * mỏng dữ liệu nhất — chuyến riêng 1–3 ngày, độ khó dừng ở Moderate, một tour
 * `difficulty: null` — nên mọi khu thứ hai nghĩ ra cho nó đều trùng HÌNH với khu
 * đã có hoặc phải bịa; ép cho đủ đối xứng chính là cái bẫy vừa làm hỏng phương
 * án màu (ADR-0015). Prop này là phần BÙ: trang Nam có ít khu hơn nên khu mở đầu
 * của nó được dựng cao hơn và thoáng hơn. **Đừng "sửa cho cân" bằng cách thêm
 * khu thứ hai cho Nam** — xem JSDoc `THEMES` ở `lib/region-theme.ts`.
 */
export function RegionSignaturePostcards({
  eyebrow,
  heading,
  body,
  postcards,
  emphasis = false,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  postcards: readonly { title: string; caption: string }[];
  emphasis?: boolean;
}) {
  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className={cn(
        'w-full px-4 md:px-16 lg:px-24 xl:px-32',
        emphasis ? 'py-24 md:py-32' : 'py-20 md:py-24',
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` (quy ước toàn site) thay cho eyebrow `font-mono` tự
              chế port từ Nexora. Nó là `text-foreground`, KHÔNG tô `--primary`:
              primary trên băng phớt này đo được 5.11:1 ở light nhưng 3.03:1 ở
              dark. Xem `region-signature-timeline.tsx` cho lý lẽ đầy đủ. Eyebrow
              `text-foreground` trên băng đo 12.67:1 light / 10.65:1 dark. */}
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {heading}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{body}</p>
        </div>

        <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-3 sm:gap-6">
          {postcards.map((card, i) => (
            <figure
              key={card.title}
              className={cn(
                'relative overflow-hidden rounded-2xl text-on-media',
                // Ô cao hơn (3:4 thay 4:5) là phần bù dựng-lớn-hơn của miền Nam.
                emphasis ? 'aspect-3/4' : 'aspect-4/5',
                // So le nhẹ: hai ô ngoài tụt xuống, ô giữa nhô lên. `transform`
                // là hiệu ứng trang trí nên tắt hẳn khi người dùng tắt chuyển động.
                i === 1 ? 'sm:-translate-y-4' : 'sm:translate-y-4',
                'motion-reduce:transform-none',
              )}
            >
              {/* `decorative`: nhãn ô sẽ trùng nguyên văn `<h3>` trong
                  `<figcaption>` bên dưới — đọc hai lần cùng một tên bưu thiếp.
                  Chữ trong caption mới là thứ mang thông tin. */}
              <RegionTile label={card.title} decorative className="absolute inset-0 rounded-none" />
              {/* Scrim từ đáy lên — caption đọc được (đo 11.19:1) mà ô vẫn thấy
                  được là một mảng màu, không bị phủ kín. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-scrim via-scrim/25 to-transparent"
              />
              <figcaption className="absolute inset-x-0 bottom-0 p-5">
                {/* Vạch hổ phách `--rating` trên đầu bưu thiếp — trang trí
                    thuần. Nó nằm trên đáy dốc của `RegionTile` (stop `--hero`)
                    nên đo 6.55:1 light / 9.34:1 dark, không có nguy cơ chìm. */}
                <span aria-hidden="true" className="mb-2 block h-1 w-9 rounded-full bg-rating" />
                <p className="font-mono text-xs tracking-widest text-on-media/80 uppercase">
                  {card.caption}
                </p>
                <h3
                  className={cn(
                    'font-heading font-medium text-balance',
                    emphasis ? 'text-2xl' : 'text-xl',
                  )}
                >
                  {card.title}
                </h3>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
