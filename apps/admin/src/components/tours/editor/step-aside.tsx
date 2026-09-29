import { messages } from '@tourism/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon, CircleCheckIcon, LightbulbIcon, StarIcon } from 'lucide-react';
import type * as React from 'react';
import { type TourCardPreviewVM, tourPhotoThumb } from '@/lib/tour-editor-view';

/**
 * Khối dùng chung của cột phải mỗi bước (ADR-0049 §6). Nơi dùng truyền dữ liệu ĐANG
 * SOẠN vào — khối không tự đọc form hay server.
 */
const e = messages.admin.tours.editor;
const a = e.aside;

export type ChecklistState = 'ok' | 'warn' | 'optional';

export interface ChecklistItem {
  key: string;
  label: string;
  /** Dòng phụ dưới nhãn: "Required to go on sale", số ảnh còn thiếu alt… */
  detail: string;
  state: ChecklistState;
}

/** Dấu trạng thái: icon cho mắt, chữ cho trình đọc màn hình. */
export function StateMark({ state, className }: { state: ChecklistState; className?: string }) {
  return (
    <>
      {state === 'ok' ? (
        <CircleCheckIcon
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-success', className)}
        />
      ) : state === 'warn' ? (
        <CircleAlertIcon
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-warning', className)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 rounded-full border border-dashed border-muted-foreground/60',
            className,
          )}
        />
      )}
      <span className="sr-only">{e.steps.state[state]}</span>
    </>
  );
}

/** "This step" — việc cần làm của bước, tính trên giá trị đang soạn. */
export function StepChecklist({
  items,
  title = a.thisStep,
  description = a.thisStepBody,
}: {
  items: readonly ChecklistItem[];
  title?: string;
  description?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5 text-sm">
              <StateMark state={item.state} className="mt-0.5" />
              <div className="grid gap-0.5">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "Tips" — gợi ý viết, chữ tĩnh của từng bước. */
export function StepTips({ items }: { items: readonly string[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LightbulbIcon aria-hidden="true" className="size-4" />
          {a.tips}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid list-disc gap-1.5 pl-5 text-xs text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Ảnh bìa như card /tours cắt nó: khung 3:2, `object-cover` bằng CSS — không `c_fill`
 * ở URL (ADR-0020 §4). Ảnh là trang trí: tên tour đã nói nó là gì.
 */
export function CoverPreviewCard({ url }: { url: string | null }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.photos.coverTitle}</CardTitle>
        <CardDescription>{a.photos.coverBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <CoverFrame url={url} />
      </CardContent>
    </Card>
  );
}

/** Khung ảnh 3:2 dùng chung cho ảnh bìa và thẻ xem trước. */
export function CoverFrame({ url, children }: { url: string | null; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-muted">
      {url ? (
        // biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005), như cả admin
        <img src={tourPhotoThumb(url)} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
          {a.preview.noCover}
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * Thẻ xem trước card /tours (spec F19 §2d.1) — bám `tour-list-card.tsx` của web, dùng
 * lại chữ của nó. Hai chỗ khác card thật đều nói ra bằng chữ: giá là giá GỐC (card web
 * in giá chuyến rẻ nhất sắp tới — admin không có số ấy), và chip Featured nhường chỗ cho
 * chip giảm giá.
 */
export function TourCardPreview({ preview }: { preview: TourCardPreviewVM }) {
  const tp = messages.toursPage;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.preview.title}</CardTitle>
        <CardDescription>{a.preview.body}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <CoverFrame url={preview.coverUrl}>
          {preview.featured ? (
            <span className="absolute top-2 left-2 inline-flex h-5 items-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
              {tp.featuredBadge}
            </span>
          ) : null}
        </CoverFrame>
        {preview.featured ? (
          <p className="text-xs text-muted-foreground">{a.preview.featuredNote}</p>
        ) : null}
        {preview.facts ? (
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {preview.facts}
          </p>
        ) : null}
        <p className="truncate font-heading text-base font-medium">{preview.title}</p>
        {/* Giữ chỗ 2 dòng như card web: tóm tắt rỗng không làm thẻ co lại. */}
        <p className="line-clamp-2 h-[2lh] text-xs text-muted-foreground">{preview.summary}</p>
        <p className="flex items-center gap-1.5 text-xs">
          {preview.rating === null ? (
            <span className="text-muted-foreground">{tp.notRated}</span>
          ) : (
            <>
              <StarIcon aria-hidden="true" className="size-3.5 fill-rating text-rating" />
              <span className="font-semibold">{preview.rating.value}</span>
              <span className="text-muted-foreground">({preview.rating.count})</span>
            </>
          )}
        </p>
        <div className="flex items-baseline justify-between gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground">{a.preview.basePrice}</span>
          <span className="text-sm font-semibold tabular-nums">{preview.price}</span>
        </div>
        <p className="text-xs text-muted-foreground">{a.preview.priceNote}</p>
      </CardContent>
    </Card>
  );
}
