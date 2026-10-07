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
import { SafeImg } from '@/components/kit/safe-img';
import { ClampedSummary } from '@/components/tours/editor/clamped-summary';
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

/**
 * "This step" — việc cần làm của bước, tính trên giá trị đang soạn. `description` đổi
 * được vì bước Photos có một dòng là luật LƯU (alt), không chỉ luật bán.
 */
export function StepChecklist({
  items,
  description = a.thisStepBody,
}: {
  items: readonly ChecklistItem[];
  description?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.thisStep}</CardTitle>
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

/** Card gạch đầu dòng chữ tĩnh: "Tips" của mỗi bước, "When it goes on sale" của Review. */
export function NoteCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon?: React.ReactNode;
  items: readonly string[];
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
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

/** "Tips" — gợi ý viết, chữ tĩnh của từng bước. */
export function StepTips({ items }: { items: readonly string[] }) {
  return (
    <NoteCard
      title={a.tips}
      icon={<LightbulbIcon aria-hidden="true" className="size-4" />}
      items={items}
    />
  );
}

/** Card "On this step · Optional" của hai bước tuỳ chọn (FAQ & policies, Costs). */
export function OptionalStepCard({ children }: { children?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{a.onThisStep}</CardTitle>
        <CardDescription>{a.optionalStep}</CardDescription>
      </CardHeader>
      {children ? <CardContent className="grid gap-1">{children}</CardContent> : null}
    </Card>
  );
}

/**
 * Link nhảy tới một khối của CHÍNH bước này (danh mục ngày, FAQ, Policies). Không để
 * trình duyệt đổi `#hash`: mục lịch sử do trình duyệt tạo mang `state` null, Next 16 bỏ
 * qua popstate của nó (`app-router.js`), nên về sau Back đổi URL mà không đổi trang, và
 * hộp hỏi lại (so pathname với URL hiện tại) để lọt một lần rời bước — mất bản sửa chưa
 * lưu (vòng review F19). Thay vào đó cuộn tới đích và dời tiêu điểm vào nó; `href` giữ
 * cho ngữ nghĩa link. `{' '}` giữa hai phần để tên truy cập không dính chữ ("Day 2 Done").
 */
export function AsideJumpLink({
  targetId,
  label,
  meta,
}: {
  targetId: string;
  label: React.ReactNode;
  meta: React.ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (target === null) return;
        event.preventDefault();
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
      }}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label} {meta}
    </a>
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
function CoverFrame({ url, children }: { url: string | null; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-muted">
      {url ? (
        // Kit `SafeImg` (review AL4): ảnh hỏng thành ô lấp khung mang tên "Photo unavailable".
        // `rounded-[inherit]`: góc theo khung, viền đứt của ô hỏng không bị góc khung xén.
        <SafeImg src={tourPhotoThumb(url)} alt="" className="size-full rounded-[inherit]" />
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
        <ClampedSummary text={preview.summary} />
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
