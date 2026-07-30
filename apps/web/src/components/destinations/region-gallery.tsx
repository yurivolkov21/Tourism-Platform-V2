'use client';

import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
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
 *  · **`lanterns`** (Trung) — hàng ô dọc treo trên "dây" dài ngắn khác nhau, cuộn
 *    ngang; Hội An là phố đèn lồng, và đây là hình của nó.
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

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          {/* `SectionEyebrow` là một hàng flex chiếm trọn bề ngang nên `text-center`
              của khối cha KHÔNG kéo nó vào giữa — phải bọc `flex justify-center`,
              đúng cách `home/gallery.tsx` (khu căn giữa duy nhất khác của site đang
              dùng eyebrow này) làm. */}
          <div className="flex justify-center">
            <SectionEyebrow>{t.galleryEyebrow}</SectionEyebrow>
          </div>
          {/* Cascade header (Task 5m). Khu này ĐÃ là `'use client'` (lightbox có
              state) nên dùng `RevealHeading` ở đây không phải để tránh chi phí client
              — nó để chín khu chạy CÙNG một bộ số, thay vì thêm bản copy thứ 20 của
              spring 240 gõ inline. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.galleryHeading(region.name)}
          </RevealHeading>
          <RevealLede className="mt-2 text-pretty text-muted-foreground">
            {t.gallerySubtitle}
          </RevealLede>
        </div>

        {variant === 'peaks' ? <PeaksLayout labels={labels} onOpen={setOpenAt} /> : null}
        {variant === 'lanterns' ? <LanternsLayout labels={labels} onOpen={setOpenAt} /> : null}
        {variant === 'panorama' ? <PanoramaLayout labels={labels} onOpen={setOpenAt} /> : null}
      </div>

      {/* Ô trong lightbox là `decorative`: nhãn cảnh đã ở chú thích ngay dưới, để
          nguyên `role="img"` là bắt trình đọc màn hình đọc cùng một câu hai lần.
          `withIcon` vì ô vẫn đứng đúng vị trí một tấm ảnh. */}
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
    </section>
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
 * Một hàng ô dọc treo trên dây, cuộn ngang.
 *
 * `overflow-x-auto` nằm trên CHÍNH container này — thiếu nó là sáu ô rộng 380px
 * đẩy thân trang cuộn ngang, lỗi thấy ngay ở 390px.
 *
 * `data-lenis-prevent`: Lenis chặn wheel trên cả tài liệu nên lăn chuột trong vùng
 * cuộn lồng lại cuộn TRANG CHÍNH. Thuộc tính này trả wheel về cho đây — cùng khuôn
 * `departure-strip.tsx` và `departures-table.tsx`.
 *
 * Dải chảy RA TỚI MÉP MÀN HÌNH ở MỌI bề ngang: mỗi cặp `-mx-N px-N` khớp đúng một
 * bậc gutter của section (`px-4 md:px-16 lg:px-24 xl:px-32`). Âm lề đúng bằng
 * padding nên bề rộng dải = bề rộng viewport, KHÔNG rộng hơn, nên không sinh cuộn
 * ngang cho body; `px-N` bên trong giữ ô đầu thẳng hàng với tiêu đề khu.
 *
 * Vì sao phải bleed cả ở desktop (bản đầu `md:mx-0 md:px-0`): ô 380px + gap 20 thì
 * ĐÚNG BA ô lấp kín khung `max-w-7xl` ở 1440 (1180 trên 1184 khả dụng) — ô thứ tư
 * nằm hẳn ngoài, không hở một mm. Chụp lại thì dải đọc thành một hàng ba ô tĩnh và
 * không có gì nói còn ảnh nữa. Bleed đẩy mép phải ra ngoài khung nên ô kế tiếp luôn
 * bị CẮT ở mép, và một ô bị cắt là tín hiệu "còn nữa" mà ai cũng đọc được.
 * ⚠️ Sửa gutter của `<section>` thì phải sửa cả bốn cặp ở đây — lệch một bậc là
 * thân trang cuộn ngang. `region-gallery.spec.tsx` canh từng cặp.
 *
 * Ô cao hơn rộng (`aspect-4/5`, 380×475 ở desktop) vì đèn lồng TREO — một ô vuông
 * dưới sợi dây đọc ra carousel. Bản 5k dùng ô vuông 176px, và 176px là chỗ user
 * nói *"ảnh quá nhỏ"*.
 *
 * "Dây" là `<span>` một pixel, dài ngắn xen kẽ, treo từ `border-t` của chính hàng
 * cuộn. Cả hai đều `aria-hidden` và không mang thông tin nào — nhưng chúng là thứ
 * làm hàng ô đọc ra ĐÈN LỒNG chứ không ra một carousel: đèn lồng Hội An treo so le
 * trên một sợi dây căng ngang lối, và đó là cảnh miền Trung bán. Bản đầu chỉ có dây
 * mà không có sợi ngang, chụp lại thì mấy đoạn dây treo lơ lửng từ khoảng không.
 * Sợi ngang nằm TRONG vùng cuộn nên nó chạy hết bề dài dải, đúng như một sợi dây
 * thật kéo dài quá tầm mắt.
 */
function LanternsLayout({
  labels,
  onOpen,
}: {
  labels: readonly string[];
  onOpen: (index: number) => void;
}) {
  return (
    /* ── Chữ ký miền TRUNG: trượt ngang từ TRÁI — CẢ DẢI là MỘT đơn vị (Task 5n) ──
       Đây là chỗ chữ ký miền Trung khớp nhất với hình của chính khu: dải này CUỘN
       NGANG, nên một nhịp vào theo trục ngang là nhịp của chính cái dây đèn lồng đang
       được căng ra.
       ⚠️ **Một `RevealItem` cho cả dải, KHÔNG một cái cho mỗi ô** — và đây là kết quả
       ĐO, không phải lựa chọn thẩm mỹ. Bản đầu bọc từng ô với `delay: index * 0.08`
       để có đợt quét sáu nhịp; đo ở `prefers-reduced-motion: reduce` thì đúng **2 ô
       kẹt `translateX(-16px)` vĩnh viễn**. Nguyên nhân: `IntersectionObserver` cắt
       hình chữ nhật của target qua chuỗi tổ tiên có clip TRƯỚC khi so với root, nên ô
       thứ 4–6 của một dải `overflow-x-auto` có vùng giao bằng 0 và observer không bao
       giờ bắn; observer không bắn thì `initial` ở lại mãi, kể cả trong chế độ giảm
       chuyển động (`reducedMotion="user"` chỉ tước transform của phép ANIMATE).
       Hai cách chữa đã thử và đều KHÔNG được: nới `viewport.margin` không giúp vì
       `rootMargin` nới bờ ROOT còn phép cắt bởi tổ tiên nằm ở bước trước; đặt
       `viewport.root` thành chính dải thì cả sáu ô bắn ngay lúc mount.
       Mất gì: đợt quét sáu nhịp. Được gì: dải vào như một sợi dây được kéo căng — sát
       hình đèn lồng hơn — và nhịp so le vẫn còn nguyên ở ba khu khác của miền Trung
       (`heritage` ba chặng, `dayTrips` lưới thẻ, `intro` hàng highlight), nên trục của
       miền không bị mất ở đâu cả.
       Biên độ 16px an toàn tuyệt đối tại đây bất kể khổ màn hình: transform nằm TRÊN
       chính vùng cuộn nên nó dịch cả dải trong khung `max-w-7xl`, và đã đo `scrollWidth`
       không nhích lên ở cả 1440 và 390. */
    <RevealItem enter="slide">
      <div
        data-gallery-scroll
        data-lenis-prevent
        className="-mx-4 mt-12 flex snap-x scroll-px-4 items-start gap-4 overflow-x-auto border-t border-border px-4 pb-2 sm:mt-16 sm:gap-5 md:-mx-16 md:scroll-px-16 md:px-16 lg:-mx-24 lg:scroll-px-24 lg:px-24 xl:-mx-32 xl:scroll-px-32 xl:px-32"
      >
        {labels.map((label, index) => (
          <div key={label} className="flex shrink-0 flex-col items-center">
            <span
              aria-hidden="true"
              className={cn('w-px bg-border', index % 2 === 0 ? 'h-4' : 'h-10')}
            />
            <GalleryTile
              label={label}
              index={index}
              onOpen={onOpen}
              className="aspect-4/5 w-[280px] shrink-0 snap-start sm:w-[380px]"
            />
          </div>
        ))}
      </div>
    </RevealItem>
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
