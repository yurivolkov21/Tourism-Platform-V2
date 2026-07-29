import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ArrowRightIcon } from 'lucide-react';
import { RegionTile } from '@/components/destinations/region-tile';
import type { MockRegion } from '@/mocks/types';

/** Số ô của bento bên phải — 1 ô cao + 2 ô xếp chồng, đúng ba địa điểm mà mỗi
    vùng có. Cắt tường minh để vùng nào lỡ có 4 địa điểm cũng không vỡ lưới. */
const BENTO_TILES = 3;

/**
 * Khu 2 — đoạn dẫn của vùng: chữ bên trái, bento ảnh bên phải. Port
 * `region-intro.tsx` của Nexora, khác một chỗ: CTA trỏ neo `#tours` NGAY TRÊN
 * TRANG này (Nexora trỏ `#itineraries`, một khu họ không có).
 *
 * `tags` truyền từ page chứ không gõ tay trong i18n: chúng DẪN XUẤT từ
 * `regionGlance(tours).categories`, nên thêm/bớt tour là hàng chip tự đúng theo.
 * Nexora gõ tay nên chữ sai âm thầm mỗi lần catalogue đổi.
 */
export function RegionIntro({
  region,
  tags,
  places,
}: {
  region: MockRegion;
  tags: string[];
  places: { slug: string; name: string }[];
}) {
  const t = messages.regionPage;
  const copy = t.regions[region.key];
  const tiles = places.slice(0, BENTO_TILES);

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* ── Trái: tiêu đề + vạch accent + hai đoạn + tags + CTA ── */}
        <div>
          <h2 className="font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.introHeading(region.name)}
          </h2>
          {/* Vạch accent — thứ DUY NHẤT trong khu này mang màu vùng, nên nó là
              chữ ký nhỏ chứ không phải trang trí rải rác. */}
          <div
            aria-hidden="true"
            style={{ background: 'var(--region-primary)' }}
            className="mt-5 h-1 w-12 rounded-full"
          />

          <p className="mt-5 text-lg text-pretty text-muted-foreground">{copy.intro}</p>
          <p className="mt-4 text-pretty text-muted-foreground">{copy.intro2}</p>

          {/* Vùng chưa có tour nào thì `tags` rỗng (chúng dẫn xuất từ chuyên mục
              của tour) — bỏ CẢ hàng, không để lại mỗi nhãn "Best for:" treo lơ
              lửng không theo sau thứ gì. */}
          {tags.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t.bestForLabel}:</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Nền là token VÙNG nên đặt qua `style`, và inline style luôn thắng
              `hover:bg-primary/90` của variant mặc định — hover đổi độ mờ thay
              vì đổi nền, nếu không nút này sẽ không phản hồi gì khi rê chuột. */}
          <ButtonLink
            href="#tours"
            style={{ background: 'var(--region-primary)' }}
            className="mt-8 text-on-media transition-opacity hover:opacity-90"
          >
            {t.browseCta(region.name)}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>

        {/* ── Phải: bento 3 ô — một ô cao bên trái, hai ô chồng bên phải ──
            Chiều cao CỐ ĐỊNH (`h-96`) chứ không theo tỉ lệ ảnh: `MockMediaItem`
            khai `width`/`height` nullable, nên bố cục không được phụ thuộc tỉ lệ
            nội tại của ảnh thật sau này.
            Vùng chưa có địa điểm nào thì bỏ hẳn bento — `h-96` với 0 ô là một
            khoảng trống 384px không giải thích được. */}
        {tiles.length > 0 ? (
          <div className="grid h-96 grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
            {tiles.map((place, i) => (
              <RegionTile
                key={place.slug}
                label={place.name}
                className={i === 0 ? 'row-span-2 h-full' : 'h-full'}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
