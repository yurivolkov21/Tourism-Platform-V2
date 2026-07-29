import { messages } from '@tourism/i18n';
import { CompassIcon, type LucideIcon, MapPinIcon, SparklesIcon } from 'lucide-react';
import type { MockRegion } from '@/mocks/types';

/** Icon theo THỨ TỰ mục, đúng bộ Nexora dùng. Ba mục là hằng số của copy nên
    danh sách này không cần dài hơn; `?? SparklesIcon` là lưới an toàn nếu copy
    nở ra mục thứ tư. */
const ICONS: readonly LucideIcon[] = [SparklesIcon, CompassIcon, MapPinIcon];

/**
 * Khu "What makes {region} special" — ba thẻ có khung, mỗi thẻ một chip icon
 * tròn tô màu vùng. Đây là khu DUY NHẤT của trang dùng thẻ có viền: nó nằm cạnh
 * một băng signature liền khối (tối hoặc tint), nên khung ở đây là thứ tách hai
 * khu ra chứ không phải viền thừa.
 */
export function RegionHighlights({ region }: { region: MockRegion }) {
  const t = messages.regionPage;
  const items = t.regions[region.key].highlights;

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-3xl font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
          {t.highlightsHeading(region.name)}
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ICONS[i] ?? SparklesIcon;
            return (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-6">
                {/* Chip ĐẶC (nền màu vùng + icon `on-media`), KHÔNG phải chip phớt
                    + icon màu vùng như Nexora. Lý do là phép ĐO, không phải gu:
                    token `--region-*` không đổi theo theme, nên icon màu vùng trên
                    nền pha 88% đo được 3.92–7.25:1 ở light nhưng chỉ 1.59–2.92:1 ở
                    dark — dưới ngưỡng 3.0 của đồ hoạ phi văn bản. Nền đặc thì cặp
                    `on-media` trên `--region-primary` cố định 4.59–8.91:1 ở CẢ HAI
                    theme, vì cả hai token đều bất biến theo theme.
                    Đây cũng là cùng một cách tô mà chip tab đang chọn ở khu TOURS
                    và nút CTA khu intro dùng — cả trang có ĐÚNG MỘT kiểu accent. */}
                <span
                  style={{ background: 'var(--region-primary)' }}
                  className="mb-4 flex size-12 items-center justify-center rounded-full text-on-media"
                >
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-heading text-xl font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-pretty text-muted-foreground">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
