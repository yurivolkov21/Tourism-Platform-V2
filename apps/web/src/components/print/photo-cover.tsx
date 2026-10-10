import { DocLetterhead } from '@tourism/ui/components/print-doc/doc-letterhead';
import { PRINT_LABEL } from '@tourism/ui/lib/print-styles';
import { cn } from '@tourism/ui/lib/utils';
import type { PrintPhoto } from '@/lib/print/print-ticket';
import { PrintBrand } from './print-brand';

/**
 * Bìa ảnh của tài liệu in khách (5b, B1; ADR-0057 §4): ảnh tour, lớp phủ tối dần, đầu trang đảo
 * màu, kicker và tên tour ở đáy. Thiếu ảnh thì nền `hero`. Tên tour cắt ở hai dòng; cỡ chữ do nơi
 * gọi chọn (`titleClass`).
 */
export function PhotoCover({
  photo,
  heightClass,
  titleClass,
  docType,
  meta,
  kicker,
  title,
}: {
  photo: PrintPhoto | null;
  heightClass: string;
  titleClass: string;
  docType: string;
  meta: string;
  kicker: string;
  title: string;
}) {
  return (
    <div
      data-slot="print-cover"
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden rounded-[3mm] bg-hero px-[7mm] py-[6mm] text-on-media',
        heightClass,
      )}
    >
      {photo ? (
        // biome-ignore lint/performance/noImgElement: ảnh bìa in phải tải ngay cả khi tài liệu đang ẩn, và in được khi người in tắt "Background graphics" — next/image hoãn tải ảnh ngoài khung nhìn (ADR-0057 §4).
        <img
          src={photo.url}
          alt={photo.alt}
          loading="eager"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-hero/55 via-hero/5 via-38% to-hero/75"
      />
      <DocLetterhead
        className="relative"
        tone="photo"
        brand={<PrintBrand />}
        docType={docType}
        meta={meta}
      />
      <div className="relative mt-auto">
        <p className={cn(PRINT_LABEL, 'text-on-media/85')}>{kicker}</p>
        <h2
          className={cn(
            'mt-[2mm] line-clamp-2 font-heading leading-[1.1] font-semibold tracking-[-0.01em]',
            titleClass,
          )}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}
