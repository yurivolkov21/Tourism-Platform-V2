import { messages } from '@tourism/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { cn } from '@tourism/ui/lib/utils';
import { CircleAlertIcon, CircleCheckIcon, LightbulbIcon } from 'lucide-react';
import type * as React from 'react';
import { tourPhotoThumb } from '@/lib/tour-editor-view';

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
