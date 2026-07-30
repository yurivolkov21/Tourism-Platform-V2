'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { RegionTile } from '@/components/destinations/region-tile';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { Lightbox } from '@/components/media/lightbox';
import { RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { RevealItem } from '@/components/motion/reveal-item';
import { STAGGER } from '@/lib/motion';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';
import type { MockRegion } from '@/mocks/types';

export type GalleryVariant = 'peaks' | 'lanterns' | 'panorama';

/**
 * Số ô mỗi biến thể dùng. Nhãn lấy từ `regions[key].galleryTiles` — **mỗi vùng
 * một danh sách RIÊNG, dài đúng bằng con số ở đây**.
 *
 * ⚠️ Trước 30/07 nhãn cắt từ MỘT danh sách `galleryTiles` dùng chung 10 mục, và
 * điều đó sai hai lần: ba vùng cắt cùng đầu danh sách nên **chú thích giống hệt
 * nhau** (user yêu cầu ba gallery khác nhau), và vài nhãn thuộc vùng KHÁC — trang
 * miền Bắc chú thích "Lantern-lit old town" (Hội An, miền Trung) và "Riverside
 * floating market" (Cần Thơ, miền Nam). Cùng họ lỗi với 7 địa danh bịa mà §7 đã
 * cắt, chỉ nhẹ hơn: chú thích mô tả một cảnh KHÔNG có trong vùng đang xem.
 * Danh sách chung đã xoá khỏi i18n — đừng dựng lại.
 *
 * Rơi từ 8 · 10 · 3 (bản 5k) xuống 6 · 6 · 3: user duyệt bản đó và nêu *"ảnh
 * gallery quá nhỏ"*. Trong cùng một bề ngang, ít ô là điều kiện DUY NHẤT để mỗi ô
 * to ra — bốn cột 280px thành ba cột 413px, mười ô 176px thành sáu ô 380px.
 *
 * `export` để spec khoá con số lại chứ không đọc lại chính hằng số của mình: đây
 * là quyết định thiết kế user đã duyệt, đổi nó là đổi thứ họ nhìn thấy.
 */
export const TILE_COUNT: Record<GalleryVariant, number> = { peaks: 6, lanterns: 6, panorama: 3 };

/**
 * Ba cột của `peaks`. `pad` là khoảng lệch DỌC (chỉ từ `sm` trở lên), `heights`
 * là chiều cao hai ô trong cột (cũng chỉ từ `sm` — dưới đó một cột, ô đều nhau).
 *
 * Ba cột cộng lại luôn cao **141 đơn vị** (`pad + h1 + gap(5) + h2`, đơn vị
 * 0.25rem → 564px). Đó là điều kiện để đáy dải THẲNG trong khi đỉnh dải RĂNG
 * CƯA — nếu cả hai mép đều so le thì dải đọc thành một khảm xếp lỗi chứ không
 * thành đường chân trời. Cột nào sửa chiều cao thì phải sửa `pad` bù lại đúng số
 * đó; `region-gallery.spec.tsx` canh tổng này nên sai là đỏ ngay.
 *
 * Chênh lệch chiều cao ở hàng TRÊN là 96 · 56 · 64, tức ô giữa cao **1.71 lần**
 * ô thấp nhất. Bản 5k dùng 56–72 trên bốn cột (1.29 lần) và user đọc ra *"một
 * lưới, không ra dãy núi"* — biên độ phải MẠNH mới thành hình.
 *
 * Hàng DƯỚI cố ý lệch pha: cao nhất ở cột 0 (72), không ở cột giữa. Cột giữa cao
 * nhất ở cả hai hàng thì dải chỉ là một cột phình ra giữa một lưới.
 */
const PEAK_COLUMNS = [
  { pad: 'sm:pt-8', heights: ['sm:h-56', 'sm:h-72'] },
  { pad: 'sm:pt-0', heights: ['sm:h-96', 'sm:h-40'] },
  { pad: 'sm:pt-12', heights: ['sm:h-64', 'sm:h-60'] },
] as const;

/** Chiều cao ô ở mobile — ĐỀU nhau và thấp hơn hẳn desktop. Dưới `sm` chỉ có một
    cột, nên giữ nguyên 384px của ô giữa là đẩy trang mobile dài thêm hơn 1.000px
    cho một khu giới thiệu. Khoảng lệch dọc cũng tắt ở đó (`sm:pt-*`): ở bề ngang
    390px thì ba cột so le chỉ còn là mấy khoảng trống rời rạc. */
const PEAK_MOBILE_HEIGHT = 'h-44';

/**
 * Khu "{region} in photos" — MỘT khu, BA bố cục.
 *
 * Ràng buộc user chốt: *"mỗi miền bắt buộc có gallery riêng"*, khác BỐ CỤC chứ
 * không chỉ khác số ô. Ba biến thể vì thế khác nhau ở hình khối, và mỗi hình cắm
 * vào cảnh vùng đó thật sự bán:
 *
 *  · **`peaks`** (Bắc) — ba cột lệch dọc so le, đỉnh dải răng cưa như dãy núi.
 *  · **`lanterns`** (Trung) — hàng ô dọc treo trên "dây" dài ngắn khác nhau, chạy
 *    NGANG theo tiến độ cuộn dọc trong một khung sticky (Task 5o, khuôn
 *    `home/gallery.tsx`); Hội An là phố đèn lồng, và đây là hình của nó.
 *  · **`panorama`** (Nam) — một ô rộng 16/9 trên hai ô lệch bề rộng: mặt nước của
 *    delta rồi rẽ hai nhánh không đều, thứ miền Nam bán.
 *
 * CÓ lightbox (Task 5l) — trước đây không, và đó là quyết định SAI: lý lẽ cũ
 * ("ô là giữ chỗ nên phóng to chỉ thấy icon") đúng về mặt kỹ thuật nhưng user vào
 * trang và bấm, rồi báo *"mình chưa thấy click vào được"*. Ô ảnh trong một khu
 * tên là "in photos" thì người ta MONG nó bấm được, và khi có ảnh thật thì hành
 * vi đó phải sẵn rồi. Dùng `Lightbox` dùng chung — cùng bản với trang chi tiết
 * tour, nên hai chỗ không thể lệch nhau về trợ năng.
 *
 * Khu này LUÔN đứng trên băng phớt ở cả ba miền: nó là khu ảnh, và một khu ảnh
 * trên nền trang thì các ô trôi nổi không có gì giữ. Băng cũng là thứ tạo nhịp —
 * xem bản đồ khu ở `lib/region-theme.ts`.
 */
export function RegionGallery({
  region,
  variant,
}: {
  region: MockRegion;
  variant: GalleryVariant;
}) {
  const t = messages.regionPage;
  const lb = t.galleryLightbox;
  // Nhãn của CHÍNH vùng này. `slice` là chốt chặn cuối, không phải cơ chế chính:
  // spec khẳng định mỗi danh sách dài ĐÚNG `TILE_COUNT[variant]`, nên nếu ai thêm
  // nhãn thứ bảy thì test đỏ chứ không âm thầm bị cắt mất.
  const labels = t.regions[region.key].galleryTiles.slice(0, TILE_COUNT[variant]);
  const [openAt, setOpenAt] = useState<number | null>(null);

  // Ô trong lightbox là `decorative`: nhãn cảnh đã ở chú thích ngay dưới, để nguyên
  // `role="img"` là bắt trình đọc màn hình đọc cùng một câu hai lần. `withIcon` vì ô
  // vẫn đứng đúng vị trí một tấm ảnh.
  // Dựng thành BIẾN (Task 5o) vì hai hình `<section>` cùng cần nó — và cả hai phải
  // dùng đúng MỘT bản, nếu không hai biến thể sẽ có hai hợp đồng trợ năng.
  const lightbox = (
    <Lightbox
      count={labels.length}
      openAt={openAt}
      onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
      onNavigate={setOpenAt}
      dialogTitle={lb.dialogTitle}
      counterLabel={lb.counter}
      closeLabel={lb.close}
      previousLabel={lb.previous}
      nextLabel={lb.next}
      caption={(index) => labels[index] ?? null}
      renderMedia={(index) => (
        <RegionTile
          label={labels[index] ?? ''}
          decorative
          withIcon
          className="aspect-16/10 w-full rounded-lg"
        />
      )}
    />
  );

  // `lanterns` rẽ SỚM vì nó là biến thể DUY NHẤT cần hình `<section>` khác: cao 180vh
  // với một khung sticky bên trong (Task 5o). Nhồi nó vào cùng cây JSX với hai biến
  // thể kia thì mỗi lớp của section phải mang một ternary, và `peaks`/`panorama` —
  // hai bố cục user đã duyệt — bị đụng ở từng dòng mà không đổi hành vi gì.
  if (variant === 'lanterns') {
    return (
      <LanternsSection region={region} labels={labels} onOpen={setOpenAt} lightbox={lightbox} />
    );
  }

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <GalleryHeader region={region} />
        {variant === 'peaks' ? (
          <PeaksLayout labels={labels} onOpen={setOpenAt} />
        ) : (
          <PanoramaLayout labels={labels} onOpen={setOpenAt} />
        )}
      </div>
      {lightbox}
    </section>
  );
}

/**
 * Header của khu — eyebrow · tiêu đề · đoạn dẫn.
 *
 * Tách ra thành component riêng ở Task 5o vì hai hình `<section>` giờ cùng dùng nó:
 * `peaks`/`panorama` đặt nó trong khung `max-w-7xl` thường, còn `lanterns` đặt nó
 * TRONG khung sticky (đó là điều làm tiêu đề đứng yên suốt hành trình cuộn). Nhân bản
 * bốn dòng lớp typography ra hai chỗ là mở đường cho hai header trôi khỏi nhau.
 */
function GalleryHeader({ region }: { region: MockRegion }) {
  const t = messages.regionPage;

  return (
    <div className="mx-auto max-w-2xl text-center">
      {/* `SectionEyebrow` là một hàng flex chiếm trọn bề ngang nên `text-center` của
          khối cha KHÔNG kéo nó vào giữa — phải bọc `flex justify-center`, đúng cách
          `home/gallery.tsx` (khu căn giữa duy nhất khác của site đang dùng eyebrow
          này) làm. */}
      <div className="flex justify-center">
        <SectionEyebrow>{t.galleryEyebrow}</SectionEyebrow>
      </div>
      {/* Cascade header (Task 5m). Khu này ĐÃ là `'use client'` (lightbox có state)
          nên dùng `RevealHeading` ở đây không phải để tránh chi phí client — nó để
          chín khu chạy CÙNG một bộ số, thay vì thêm bản copy thứ 20 của spring 240 gõ
          inline. */}
      <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
        {t.galleryHeading(region.name)}
      </RevealHeading>
      <RevealLede className="mt-2 text-pretty text-muted-foreground">
        {t.gallerySubtitle}
      </RevealLede>
    </div>
  );
}

/**
 * Ô gallery — một `<button>` mở lightbox tại đúng index của nó.
 *
 * Tên khả truy cập nói CẢNH, không nói vị trí (khác `TourGallery`, chỗ đó nói
 * "Open photo 3 of 6"): ở đây nhãn cảnh là thứ CÓ THẬT trong i18n cho từng ô, còn
 * `alt` của ảnh tour thì nullable nên ô khảm tour không được hứa mô tả.
 *
 * Vòng focus vẽ INSET (`-outline-offset-2`): ô có `overflow-hidden` để gradient bị
 * bo góc cắt, nên vòng vẽ ra ngoài sẽ bị chính ô cắt mất — tab qua gallery mà
 * không thấy mình đang ở đâu. Màu `on-media` chứ không `primary`: nền ô LÀ một
 * dốc từ `--primary`, vẽ vòng primary lên đó là vẽ vô hình.
 *
 * Zoom hover theo công thức chuẩn của repo (`tour-gallery.tsx`), có `motion-reduce`
 * ở CẢ transition lẫn scale — thiếu vế scale thì ô vẫn nhảy, chỉ là nhảy tức thì.
 */
function GalleryTile({
  label,
  index,
  onOpen,
  className,
  peakRow,
  panoramaLead = false,
}: {
  label: string;
  index: number;
  onOpen: (index: number) => void;
  className?: string;
  /** Chỉ `peaks` truyền — spec đọc nó để canh hai hàng lệch pha. */
  peakRow?: number;
  /** Chỉ `panorama` bật — móc cấu trúc để spec phân biệt hình của ba biến thể. */
  panoramaLead?: boolean;
}) {
  return (
    <button
      type="button"
      data-gallery-tile
      data-peak-row={peakRow}
      data-panorama-lead={panoramaLead ? '' : undefined}
      onClick={() => onOpen(index)}
      aria-label={messages.regionPage.galleryLightbox.open(label)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-media',
        className,
      )}
    >
      <RegionTile
        label={label}
        decorative
        withIcon
        className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    </button>
  );
}

/** Ba cột, hai ô mỗi cột, đỉnh răng cưa. Dưới `sm` về MỘT cột: ở bề ngang đó ba
    cột so le chỉ còn là khoảng trống rời rạc, và một ô full-width là ô to nhất
    mobile có thể cho. */
function PeaksLayout({
  labels,
  onOpen,
}: {
  labels: readonly string[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5">
      {PEAK_COLUMNS.map((column, columnIndex) => (
        /* ── Chữ ký miền BẮC: trồi lên theo `y`, stagger theo CỘT (Task 5n) ──
           Stagger theo cột chứ không theo từng Ô: hai ô của một cột là MỘT đỉnh núi
           (đó là toàn bộ lý do `PEAK_COLUMNS` tồn tại), nên tách chúng ra hai nhịp là
           xé một đỉnh thành hai mảnh. Ba cột nối nhau trái→phải thì dải đọc ra một
           đường chân trời đang dựng lên — đúng hình mà biến thể này đi tìm.
           `RevealItem` bọc NGOÀI cột thay vì thay chỗ nó: cột phải giữ
           `data-peak-column` cùng lớp `sm:pt-*`, thứ `region-gallery.spec.tsx` đọc để
           canh bất biến "ba cột cao bằng nhau = 141 đơn vị". */
        <RevealItem
          // biome-ignore lint/suspicious/noArrayIndexKey: PEAK_COLUMNS là hằng ở module scope, không sắp lại và không thêm bớt
          key={columnIndex}
          enter="rise"
          delay={columnIndex * STAGGER.grid}
        >
          <div
            data-peak-column={columnIndex}
            className={cn('flex flex-col gap-4 sm:gap-5', column.pad)}
          >
            {column.heights.map((height, row) => {
              const index = columnIndex * 2 + row;
              const label = labels[index];
              // `noUncheckedIndexedAccess` khai mọi truy cập theo chỉ số là có thể
              // `undefined`. Ba cột × hai ô = 6 = đúng số nhãn đã cắt, nên nhánh này
              // không chạy — nhưng bỏ ô còn hơn render một `aria-label` rỗng.
              if (!label) return null;
              return (
                <GalleryTile
                  key={label}
                  label={label}
                  index={index}
                  onOpen={onOpen}
                  peakRow={row}
                  className={cn('w-full', PEAK_MOBILE_HEIGHT, height)}
                />
              );
            })}
          </div>
        </RevealItem>
      ))}
    </div>
  );
}

/**
 * Dải đèn lồng của miền Trung — cuộn NGANG theo TIẾN ĐỘ CUỘN DỌC của trang, trong một
 * khung sticky. Không có thanh cuộn nào nhìn thấy.
 *
 * Đây là yêu cầu trực tiếp của user (Task 5o): *"chỗ gallery ở miền trung nếu bạn có
 * thể làm giống với ở trang Home chỗ mà người dùng phải cuộn để xem các địa điểm …
 * hãy áp dụng kiểu đó vào trong gallery ở đây rồi loại bỏ thanh cuộn ngang nằm phía
 * dưới nữa thì sẽ hợp lí hơn."*
 *
 * ## Khuôn mượn từ `home/gallery.tsx` (ĐỌC, đừng sửa file đó — nó là trang đã duyệt)
 *
 *  · `<section>` cao **180vh** bọc một khung `sticky top-0 h-screen overflow-hidden`.
 *  · **Header nằm TRONG khung sticky** nên nó đứng yên suốt hành trình cuộn.
 *  · Tiến độ = `-rect.top / (rect.height - innerHeight)`, kẹp về `0..1`.
 *
 * ## Nhưng KHÔNG chép `transform` của Home — ở đây lái bằng `scrollLeft`
 *
 * Home ghi `track.style.transform = translateX(...)`. Cách đó có hai lỗ mà trang vùng
 * không chịu được (trang vùng là SSG, và ô ở đây là `<button>` mở lightbox):
 *
 * | | `transform` (Home) | `scrollLeft` (ở đây) |
 * | --- | --- | --- |
 * | JS tắt | ô 4–6 **không bao giờ tới được** | vùng vẫn cuộn native → tới được |
 * | Tab bàn phím | focus rơi ra ngoài khung `overflow-hidden`, không thấy (WCAG 2.4.11) | trình duyệt tự cuộn ô đang focus vào tầm |
 * | Nhìn thấy | giống nhau | giống nhau |
 * | Thanh cuộn | không có | **ẩn** bằng `scrollbar-none` → user vẫn không thấy |
 *
 * Nên vùng cuộn giữ NATIVE (`overflow-x-auto`), thanh cuộn ẩn bằng utility có sẵn của
 * Tailwind v4 (`scrollbar-none` → `scrollbar-width: none`; repo đã dùng nó ở
 * `ui/components/attachment.tsx`, không cần khai CSS mới), và tiến độ cuộn dọc chỉ
 * ĐẶT `scrollLeft`. Kết quả thị giác giống Home; hai lỗ trên biến mất.
 *
 * ## Ba thứ đã BỎ cùng cơ chế cũ, mỗi thứ một lý do đo được
 *
 *  1. **`data-lenis-prevent`** — nó tồn tại để wheel cuộn DẢI thay vì trang. Cơ chế
 *     mới là *cuộn trang để dải chạy*, nên giữ nó lại là làm đúng điều NGƯỢC LẠI.
 *  2. **`snap-x` / `snap-start` / `scroll-px-*`** — snap kéo dải về mốc gần nhất sau
 *     mỗi lần cuộn dừng, tức tranh với chính con số ta vừa ghi mỗi khung hình. Snap
 *     có nghĩa khi NGƯỜI DÙNG flick một dải; ở đây vị trí là hàm của tiến độ trang.
 *  3. **`RevealItem enter="slide"` bọc cả dải** (Task 5n) — nó ghi `transform` lên
 *     ĐÚNG phần tử mà cơ chế này điều khiển. Và cái bẫy 5n đã đo (observer không bao
 *     giờ bắn cho ô 4–6 của một dải `overflow-x-auto`, nên chúng kẹt `initial` vĩnh
 *     viễn — kể cả ở `prefers-reduced-motion: reduce`) **tan** cùng nó: không còn
 *     `initial` nào trong dải để mà kẹt. Trục NGANG của miền Trung ở khu này giờ do
 *     chính phép cuộn mang, mạnh hơn một nhịp vào 16px; và nhịp `slide` vẫn còn nguyên
 *     ở ba khu khác của miền (`heritage`, `dayTrips`, `intro`).
 *
 * ## Bốn cặp âm lề `-mx-N px-N` cũng biến mất
 *
 * Chúng tồn tại để dải chảy ra tới mép màn hình trong khi vẫn nằm trong một section
 * có gutter. Khung sticky nay RỘNG BẰNG VIEWPORT nên không còn gì để bù — chỉ còn
 * `px-N` giữ ô đầu thẳng hàng với khối tiêu đề, và `overflow-hidden` của khung là thứ
 * giữ thân trang khỏi cuộn ngang (bất biến thay chỗ cặp âm lề; spec canh cả hai).
 *
 * ## Giữ nguyên
 *
 * Ô cao hơn rộng (`aspect-4/5`, 380×475 ở desktop) vì đèn lồng TREO — một ô vuông
 * dưới sợi dây đọc ra carousel; bản 5k dùng ô vuông 176px và đó là chỗ user nói *"ảnh
 * quá nhỏ"*. "Dây" là `<span>` một pixel dài ngắn xen kẽ, treo từ `border-t` của chính
 * hàng cuộn: cả hai `aria-hidden` và không mang thông tin nào, nhưng chúng là thứ làm
 * hàng ô đọc ra ĐÈN LỒNG chứ không ra một carousel. Sợi ngang nằm TRONG vùng cuộn nên
 * nó chạy hết bề dài dải, đúng như một sợi dây thật kéo dài quá tầm mắt.
 */
function LanternsSection({
  region,
  labels,
  onOpen,
  lightbox,
}: {
  region: MockRegion;
  labels: readonly string[];
  onOpen: (index: number) => void;
  lightbox: ReactNode;
}) {
  const frameRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const strip = stripRef.current;
    if (!frame || !strip) {
      return;
    }

    const sync = () => {
      const rect = frame.getBoundingClientRect();
      // Quãng cuộn dọc mà khung sticky "đứng lại": chiều cao section trừ một màn hình.
      const travel = rect.height - window.innerHeight;
      const limit = strip.scrollWidth - strip.clientWidth;
      // `limit <= 0` là ca THẬT, không phải phòng xa: ở khổ rất rộng sáu ô có thể vừa
      // hết bề ngang, và khi đó chia cho 0 sẽ ghi `NaN` vào `scrollLeft`.
      if (travel <= 0 || limit <= 0) {
        return;
      }
      const progress = Math.max(0, Math.min(1, -rect.top / travel));
      strip.scrollLeft = Math.round(progress * limit);
    };

    /**
     * Kéo ô ĐANG FOCUS vào tầm. Đo được 30/07: Tab tới ô thứ 4 thì Chromium để nó
     * **kẹt 252px ngoài mép** và KHÔNG tự cuộn (ô còn nhìn thấy một phần nên phép
     * `CenterIfNeeded` của trình duyệt coi là đủ), rồi tới ô 5 mới cuộn — và cuộn tới
     * hẳn cuối dải. Vòng focus vẫn thấy được nên WCAG 2.4.11 (Minimum) không đỏ, nhưng
     * "ô đang focus bị cắt mất một phần tư" là thứ user sẽ nhìn ra.
     *
     * Tính bằng `getBoundingClientRect` rồi cộng thẳng vào `scrollLeft` thay vì gọi
     * `scrollIntoView`: `scrollIntoView` cho trình duyệt chọn cả trục DỌC nên nó có
     * thể cuộn cả trang (và một lần cuộn trang là một lần `sync` ghi lại `scrollLeft`,
     * tức đánh nhau với chính mình). Phép cộng này chỉ chạm đúng một trục.
     *
     * `focusin` nổi bọt, nên MỘT listener trên dải phủ cả sáu ô.
     */
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const tile = target.getBoundingClientRect();
      const box = strip.getBoundingClientRect();
      if (tile.right > box.right) {
        strip.scrollLeft += tile.right - box.right;
      } else if (tile.left < box.left) {
        strip.scrollLeft -= box.left - tile.left;
      }
    };

    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    strip.addEventListener('focusin', revealFocus);
    // Đợi layout đo xong kích thước sau paint đầu — cùng con số `home/gallery.tsx` dùng.
    const timer = setTimeout(sync, 100);

    return () => {
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      strip.removeEventListener('focusin', revealFocus);
      clearTimeout(timer);
    };
  }, []);

  return (
    <section
      ref={frameRef}
      style={{ background: SIGNATURE_BAND_BG }}
      className="relative h-[180vh] w-full"
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* `data-gallery-header` là móc để `region-gallery.spec.tsx` canh rằng gutter
            của dải khớp gutter của header ở TỪNG bậc — đó là thứ giữ ô đầu thẳng hàng
            với khối tiêu đề, việc mà cặp âm lề cũ từng làm.
            `pt-32` là con số của `home/gallery.tsx`, và nó KHÔNG phải khẩu vị: khung
            sticky bắt đầu ở `top-0`, tức ngay dưới mép cửa sổ, mà `SiteHeader` nổi trên
            đó. Bản đầu tôi hạ xuống `pt-16 md:pt-20` để chừa chỗ cho ô, rồi chụp lại và
            thấy **eyebrow của khu nằm hẳn sau navbar** (navbar cao ~118px kể cả
            top-bar). Chỗ chừa cho ô phải lấy từ trần cao của ô (xem `max-h` dưới), chứ
            không lấy từ khoảng hở của navbar. */}
        <div
          data-gallery-header
          className="mx-auto w-full max-w-7xl px-4 pt-32 md:px-16 lg:px-24 xl:px-32"
        >
          <GalleryHeader region={region} />
        </div>

        <div className="flex flex-1 items-center">
          <div
            ref={stripRef}
            data-gallery-scroll
            className="flex w-full items-start gap-4 overflow-x-auto scrollbar-none border-t border-border px-4 sm:gap-5 md:px-16 lg:px-24 xl:px-32"
          >
            {labels.map((label, index) => (
              <div key={label} className="flex shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn('w-px bg-border', index % 2 === 0 ? 'h-4' : 'h-10')}
                />
                {/* `max-h-[calc(100vh-24rem)]` là TRẦN AN TOÀN, không phải kích thước
                    thiết kế: khung sticky cao đúng 100vh và phải chứa CẢ header lẫn ô,
                    nên trên màn hình THẤP thì `overflow-hidden` của khung sẽ cắt đáy ô.
                    24rem = 384px = header với tiêu đề HAI dòng (~333px: `pt-32` + eyebrow
                    + h2 hai dòng + đoạn dẫn) cộng đoạn dây (40px) cộng khe. Đo lại sau
                    khi áp, ở 1280×720 và 900×700: đáy ô còn hở 33–58px, không cắt.
                    Từ 900px cao trở lên trần này KHÔNG chạm (475 < 516) nên ô giữ đúng
                    380×475 mà user đã duyệt; dưới đó nó thấp dần thay vì bị cắt. */}
                <GalleryTile
                  label={label}
                  index={index}
                  onOpen={onOpen}
                  className="aspect-4/5 max-h-[calc(100vh-24rem)] w-[280px] shrink-0 sm:w-[380px]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {lightbox}
    </section>
  );
}

/**
 * Một ô RỘNG trên, hai ô lệch bề rộng dưới. Bó `max-w-5xl` (1024px), hẹp hơn khung
 * `max-w-7xl` của phần tiêu đề khu.
 *
 * Vì sao bó lại thì ảnh vẫn "to hẳn": ô lớn cao 576px (16/9 trên 1024), cao hơn
 * BẤT KỲ ô nào của bản 5k (ba ô 21/9 full-width, 549px). Nhưng cả khu chỉ còn
 * ~888px thay vì ~1.695px, và đó là chỗ trang Nam dài hơn hai miền kia gần 1.900px.
 *
 * Hai ô dưới KHÔNG bằng nhau (3/5 và 2/5): một cặp đối xứng dưới một ô lớn là đúng
 * cái khảm của trang chi tiết tour, và ba khu ảnh giống nhau thì mất phân hoá vùng.
 * Bề rộng lệch cũng là hình của thứ miền Nam bán — một dòng nước rẽ hai nhánh không
 * đều. Chiều cao hai ô CỐ ĐỊNH thay vì theo tỉ lệ, vì hai bề rộng khác nhau mà cùng
 * `aspect` thì hai đáy không bằng nhau và hàng vỡ.
 *
 * Dưới `sm` cả ba ô xếp dọc full-width: hai ô 3/5 và 2/5 của 358px là 207px và
 * 138px, hẹp hơn cả ô nhỏ nhất của bản cũ.
 */
function PanoramaLayout({
  labels,
  onOpen,
}: {
  labels: readonly string[];
  onOpen: (index: number) => void;
}) {
  const [lead, ...rest] = labels;
  if (!lead) return null;

  return (
    <div className="mx-auto mt-12 flex max-w-5xl flex-col gap-4 sm:mt-16 sm:gap-5">
      {/* ── Chữ ký miền NAM: NỞ RA tại chỗ, theo LỚP chứ không theo chuỗi (Task 5n) ──
          Ô LỚN vào trước (nhịp 0), rồi HÀNG DƯỚI vào như MỘT khối (nhịp 1). Đây là
          nhịp hai lớp, không phải ba nhịp nối nhau: hai ô dưới là một dòng nước đã rẽ
          hai nhánh (xem JSDoc), nên chúng thuộc cùng một lớp và tách chúng ra hai
          nhịp là kể sai hình.
          `RevealItem` bọc CẢ hàng thay vì từng ô còn là điều kiện để `sm:col-span-*`
          ở trên chính `<GalleryTile>` vẫn có tác dụng — nó phải là ô lưới trực tiếp
          của `[data-panorama-row]`, và `region-gallery.spec.tsx` đọc lớp đó ngay trên
          `[data-gallery-tile]` để canh "hai ô dưới rộng KHÁC nhau". */}
      <RevealItem enter="bloom">
        <GalleryTile
          label={lead}
          index={0}
          onOpen={onOpen}
          className="aspect-16/9 w-full"
          panoramaLead
        />
      </RevealItem>
      <RevealItem enter="bloom" delay={STAGGER.grid}>
        <div data-panorama-row className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-5">
          {rest.map((label, index) => (
            <GalleryTile
              key={label}
              label={label}
              index={index + 1}
              onOpen={onOpen}
              className={cn('h-56 w-full sm:h-72', index === 0 ? 'sm:col-span-3' : 'sm:col-span-2')}
            />
          ))}
        </div>
      </RevealItem>
    </div>
  );
}
