'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import { StarIcon } from 'lucide-react';
import { useState } from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { type ReviewRowVM, reviewStateBadgeVariant } from '@/lib/reviews-view';

/**
 * Dialog CHỈ ĐỌC của một review (vòng chỉnh 05/09, user báo).
 *
 * Vì sao phải có: nội dung đầy đủ và ảnh khách đính kèm VỐN ĐÃ hiện — nhưng
 * chỉ hiện bên trong dialog xác nhận Approve/Remove. Nghĩa là cửa duy nhất để
 * ĐỌC là một cái cửa ghi "làm đi": muốn đọc kỹ thì phải mở một hành động GHI
 * rồi bấm huỷ. Đó là dạy người ta bấm nút quyết định khi chưa quyết, và ở bảng
 * thì nội dung bị cắt còn hai dòng với bản đầy đủ nhét trong thuộc tính
 * `title` — một tooltip vô hình trên cảm ứng và không đọc nổi với 2000 ký tự.
 *
 * Cố ý KHÔNG có nút duyệt ở đây. Trộn đọc với ghi là dựng lại đúng vấn đề vừa
 * gỡ, chỉ theo chiều ngược; hai nút quyết định vẫn nằm ngay cạnh trên cùng
 * hàng, cách một cú đóng dialog.
 *
 * Component KHÔNG fetch gì: mọi thứ nó cần đã nằm trong `ReviewRowVM` mà trang
 * dựng sẵn (server component), nên mở dialog không tốn một request nào.
 */
const t = messages.admin.reviews;

export function ReviewDetailsDialog({ row }: { row: ReviewRowVM }) {
  // MỘT dialog cho mỗi hàng, mở bằng state — trang 50 hàng không mount 50 cây
  // dialog sẵn (cùng nếp `ModerateActions`).
  const [open, setOpen] = useState(false);

  return (
    <>
      {/*
        Nút BỌC chính nội dung review, không phải một icon "xem" riêng: thứ
        người ta muốn bấm là đoạn chữ đang đọc dở. `text-left` vì mặc định của
        `<button>` là căn giữa.
      */}
      <button
        type="button"
        aria-label={t.details.open(row.authorLabel)}
        onClick={() => setOpen(true)}
        className="grid w-full gap-1 rounded-sm text-left outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.title ? <div className="truncate font-medium">{row.title}</div> : null}
        <div className="line-clamp-2 text-muted-foreground">{row.body}</div>
      </button>

      {open ? (
        <Dialog open onOpenChange={setOpen}>
          {/* Rộng hơn dialog xác nhận (`sm:max-w-md`): body tới 2000 ký tự, và
              một cột hẹp biến nó thành cột báo. Trần cao + cuộn lấy từ kit.

              `showCloseButton={false}` cùng lý do đã ghi ở `ConfirmWriteDialog`:
              nút X của kit UI là `absolute` NGAY TRONG phần tử cuộn, nên nó
              trôi khuất khi cuộn — mà dialog này sinh ra để cuộn qua 2000 ký
              tự. Nút Close ở chân luôn tới được. */}
          <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-2xl')} showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t.details.title}</DialogTitle>
              {/* Ai viết và lúc nào — hai thứ định vị review TRƯỚC khi đọc nó. */}
              <DialogDescription>
                {t.details.subtitle(row.authorLabel, row.submitted)}
              </DialogDescription>
            </DialogHeader>

            {/* Khối nội dung là NGƯỜI HÙNG của dialog: đây là thứ người ta mở
                nó ra để xem, nên nó chiếm chỗ và có khung riêng. */}
            <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={row.rating} label={row.ratingLabel} />
                <Badge variant={reviewStateBadgeVariant(row.state)} className="px-1.5">
                  {row.stateLabel}
                </Badge>
                <Badge variant="outline" className="px-1.5">
                  {row.sourceLabel}
                </Badge>
              </div>
              <h3
                className={cn(
                  'font-medium',
                  row.title ? undefined : 'text-muted-foreground italic',
                )}
              >
                {row.title ?? t.details.noTitle}
              </h3>
              {/* `whitespace-pre-wrap`: khách xuống dòng để tách ý, và ép hết
                  thành một khối liền là đọc sai thứ họ viết. */}
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
            </article>

            {row.photos.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t.details.photosHeading}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {row.photos.map((photo) => (
                    // `<img>` thường, cùng lý do đã ghi ở bảng: `next/image`
                    // NÉM khi src nằm ngoài `remotePatterns`, và một hàng dữ
                    // liệu như thế sẽ giết cả dialog.
                    // biome-ignore lint/performance/noImgElement: host Cloudinary không khai trong remotePatterns
                    <img
                      key={photo.large}
                      src={photo.large}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="max-h-64 rounded-md border border-border object-contain"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <dl className="grid gap-2 text-sm">
              <LabelValueRow label={t.list.columns.tour} value={row.tourTitle ?? t.list.noTour} />
              {/* Dấu vết duyệt: `moderated` và `moderatedBy` TÁCH nhau vì
                  `moderatedBy` là FK SetNull — mất tên người duyệt không được
                  làm mất luôn mốc thời gian. Chưa ai đụng tới thì nói thẳng. */}
              <LabelValueRow
                label={t.list.columns.moderation}
                value={
                  row.moderated
                    ? [row.moderated, row.moderatedBy].filter(Boolean).join(' · ')
                    : t.list.neverModerated
                }
              />
              {/* Lý do bác (ADR-0031 §6) — `note` của quyết định gần nhất, thứ
                  từ ngày đầu được ghi vào audit trail rồi KHÔNG nơi nào đọc.
                  Đây cũng đúng là câu khách nhận trong email, nên người duyệt
                  sau đọc hồ sơ thấy chính xác thứ khách đã đọc. */}
              {row.state === 'rejected' && row.moderationNote ? (
                <LabelValueRow label={t.moderate.reasonLabel} value={row.moderationNote} />
              ) : null}
            </dl>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.details.close}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * Năm sao đầy/rỗng — khác bảng (một sao cộng con số) vì ở đây có chỗ, và một
 * dãy sao đọc được bằng liếc mắt đúng như review hiện trên site.
 *
 * Token `rating` chuyên dụng, cùng màu với tám component bên web: sao xám từng
 * làm admin và site nhìn như hai hệ (review F4 31/08).
 */
function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden="true"
          className={cn(
            'size-4',
            star <= rating ? 'fill-rating text-rating' : 'text-muted-foreground/40',
          )}
        />
      ))}
      {/* Dãy icon không nói lên thang điểm — trình đọc màn hình nghe trọn câu. */}
      <span className="sr-only">{label}</span>
    </div>
  );
}
