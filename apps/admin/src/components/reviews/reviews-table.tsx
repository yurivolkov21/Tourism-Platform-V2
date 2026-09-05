'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import {
  CalendarIcon,
  CalendarOffIcon,
  MapPinIcon,
  StarIcon,
  TagIcon,
  UserIcon,
} from 'lucide-react';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { ModerateActions } from '@/components/reviews/moderate-actions';
import { ReviewDetailsDialog } from '@/components/reviews/review-details-dialog';
import { ReviewsRatingMenu } from '@/components/reviews/reviews-rating-menu';
import { ReviewsSourceMenu } from '@/components/reviews/reviews-source-menu';
import {
  ReviewsClearFilters,
  ReviewsDateRange,
  ReviewsSearch,
  ReviewsStateTabs,
} from '@/components/reviews/reviews-toolbar';
import { formatCalendarDate, formatDateRange } from '@/lib/bookings-view';
import type { ModerateAction } from '@/lib/reviews-moderate';
import { type ReviewsQuery, reviewsHref } from '@/lib/reviews-query';
import { type ReviewRowVM, reviewStateBadgeVariant } from '@/lib/reviews-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Hàng đợi `/reviews` (spec P4b §3-F4) — vùng thật THỨ BA, dựng trọn trên kit
 * (`DataTableFrame` + `DataTableBody` + `ColumnVisibilityMenu` +
 * `TablePagination` + `serverTableFeatures`): drag-row tắt, không checkbox,
 * TanStack chỉ lo ẩn/hiện cột. Trang/filter sống trên URL (§2.2).
 *
 * Khác hai bảng trước ở đúng hai chỗ, và cả hai là bản chất của vùng:
 * - Cột "Review" mang NỘI DUNG dài (tối đa 2000 ký tự) + ảnh đính kèm, nên nó
 *   cắt bằng CSS và giữ nguyên văn trong `title` (dialog mới in đủ).
 * - Cột cuối LUÔN có nút: khác cancellations (quyết định là chung cuộc),
 *   moderation đi được cả hai chiều — duyệt rồi vẫn gỡ xuống được.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toReviewRow` (thuần,
 * có test) nấu sẵn.
 */
const t = messages.admin.reviews.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, ReviewRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  authorLabel: t.columns.author,
  rating: t.columns.rating,
  tourTitle: t.columns.tour,
  stateLabel: t.columns.state,
  submitted: t.columns.submitted,
};

/** Icon menu Columns — cùng bộ glyph với hai bảng kia (xem `bookings-table`). */
const COLUMN_ICONS = {
  authorLabel: UserIcon,
  rating: StarIcon,
  tourTitle: MapPinIcon,
  stateLabel: TagIcon,
  submitted: CalendarIcon,
};

/**
 * Cột nhận `moderate` qua tham số (không đọc từ module) để cụm nút giữ đúng
 * luật F2: client component KHÔNG tự import server action, nó nhận vào. Gọi
 * trong `useMemo` khoá theo `moderate` — `columns` là đầu vào của row model,
 * đổi tham chiếu mỗi render sẽ khiến table dựng lại model liên tục.
 */
function buildColumns(moderate: ModerateAction) {
  return columnHelper.columns([
    columnHelper.accessor('authorLabel', {
      header: t.columns.author,
      cell: ({ row }) => (
        <div className="max-w-40">
          <div className="truncate font-medium text-foreground">{row.original.authorLabel}</div>
          {/* Nguồn đứng ngay dưới tên: CURATED là nội dung biên tập, không có
              khách nào sau lưng — biết trước khi bấm thì không ngạc nhiên vì
              dialog bảo "không email nào được gửi". */}
          <div className="truncate text-xs text-muted-foreground">{row.original.sourceLabel}</div>
        </div>
      ),
    }),
    columnHelper.accessor('rating', {
      header: t.columns.rating,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          {/* Token `rating` chuyên dụng (vàng) — cùng màu sao với 8 component
              web (`filledStarClass` của reui/rating.tsx); sao xám từng làm
              admin và site nhìn như hai hệ (review F4 31/08). */}
          <StarIcon className="size-3.5 fill-rating text-rating" aria-hidden="true" />
          <span>{row.original.rating}</span>
          {/* Con số trần không nói lên thang điểm — trình đọc màn hình nghe
              trọn câu "5 out of 5" thay vì "5". */}
          <span className="sr-only">{row.original.ratingLabel}</span>
        </div>
      ),
    }),
    columnHelper.accessor('body', {
      header: t.columns.review,
      // Cột KHÔNG ẩn được: ẩn nội dung review đi thì hàng đợi moderation mất
      // hết ý nghĩa.
      enableHiding: false,
      cell: ({ row }) => <ReviewCell row={row.original} />,
    }),
    columnHelper.accessor('tourTitle', {
      header: t.columns.tour,
      cell: ({ row }) =>
        row.original.tourTitle ? (
          <div className="max-w-48 truncate" title={row.original.tourTitle}>
            {row.original.tourTitle}
          </div>
        ) : (
          // Review CURATED có thể không gắn tour — nói thẳng thay vì ô trống,
          // vì đó cũng là lý do rating tour sẽ KHÔNG đổi khi duyệt.
          <span className="text-muted-foreground">{t.noTour}</span>
        ),
    }),
    columnHelper.accessor('stateLabel', {
      header: t.columns.state,
      cell: ({ row }) => (
        <Badge variant={reviewStateBadgeVariant(row.original.state)} className="px-1.5">
          {row.original.stateLabel}
        </Badge>
      ),
    }),
    columnHelper.accessor('submitted', {
      header: t.columns.submitted,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.submitted}</div>
      ),
    }),
    columnHelper.display({
      id: 'moderation',
      header: t.columns.moderation,
      cell: ({ row }) => <ModerationCell row={row.original} moderate={moderate} />,
      enableHiding: false,
    }),
  ]);
}

/** Tiêu đề + nội dung cắt gọn (bấm được để mở bản đầy đủ) + thumbnail ảnh. */
function ReviewCell({ row }: { row: ReviewRowVM }) {
  return (
    <div className="grid max-w-96 gap-1">
      {/* Chữ cắt gọn nay là NÚT mở dialog chỉ-đọc (vòng chỉnh 05/09). Trước đó
          bản đầy đủ chỉ nằm trong thuộc tính `title` — một tooltip vô hình
          trên cảm ứng và không đọc nổi với 2000 ký tự — hoặc trong dialog xác
          nhận Approve, tức phải mở một hành động GHI mới đọc được. */}
      <ReviewDetailsDialog row={row} />
      {row.photos.length > 0 ? (
        <div className="flex items-center gap-1">
          {row.photos.map((photo) => (
            // `<img>` thường: thumbnail 32px, và `next/image` NÉM khi src nằm
            // ngoài `remotePatterns` (xem `slot-image.spec.tsx` của web) —
            // một hàng dữ liệu như thế sẽ giết cả hàng đợi moderation.
            // biome-ignore lint/performance/noImgElement: thumbnail 32px, tránh next/image ném khi host lạ
            <img
              key={photo.thumb}
              src={photo.thumb}
              alt={photo.alt}
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              className="size-8 rounded-sm border border-border object-cover"
            />
          ))}
          <span className="sr-only">{row.photosLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nút quyết định + dấu vết lần duyệt gần nhất. Cả hai cùng ở đây (khác
 * cancellations, nơi hàng đã quyết chỉ còn dấu vết): moderation đảo chiều
 * được, nên một review đã duyệt vẫn cần nút — và vẫn cần cho thấy ai duyệt.
 */
function ModerationCell({ row, moderate }: { row: ReviewRowVM; moderate: ModerateAction }) {
  return (
    <div className="grid gap-1">
      {/* Dấu vết ĐỨNG TRƯỚC nút (vá 05/09, user báo). Cột này tên "Moderation"
          — một danh từ, nên thứ nó phải trả lời đầu tiên là CHUYỆN ĐÃ XẢY RA,
          rồi mới tới việc còn làm được. Đặt nút lên trước thì mắt gặp một pill
          xanh "Approve" ngay dưới một hàng đang ở trạng thái Rejected, và đọc
          nó thành lời khẳng định chứ không phải lời mời. */}
      <div className="grid gap-0.5 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">{row.moderated ?? t.neverModerated}</span>
        {row.moderatedBy ? <span className="truncate">{row.moderatedBy}</span> : null}
      </div>
      {/* Truyền thẳng `row` (thoả cấu trúc ModerateTarget) — object literal
          11 field từng chép tay ở đây vừa tạo tham chiếu mới mỗi render (chặn
          memo về sau) vừa phải sửa tay mỗi khi Pick đổi (review F4 31/08).
          "Dialog dựa vào gì" đã do chính kiểu ModerateTarget diễn đạt. */}
      <ModerateActions review={row} moderate={moderate} />
    </div>
  );
}

export interface ReviewsTableProps {
  rows: ReviewRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: ReviewsQuery;
  total: number;
  totalPages: number;
  /** Server action `moderateReviewAction`, truyền xuống từ trang. */
  moderate: ModerateAction;
}

export function ReviewsTable({ rows, query, total, totalPages, moderate }: ReviewsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const columns = React.useMemo(() => buildColumns(moderate), [moderate]);

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL và
    // `TablePagination` nhận thẳng props (nếp hai vùng trước).
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<ReviewsStateTabs query={query} />}
      actions={
        <>
          {/* Thứ tự user chốt 05/09: KHI NÀO (khoảng ngày) → tìm chữ →
              LOẠI review (nguồn, số sao) → xoá lọc → chọn cột. Hai menu nguồn
              và số sao là bộ lọc mới của đợt trả nợ cùng ngày; server đã lọc
              cả hai từ F4 mà chưa có ô nào để bấm. */}
          <ReviewsDateRange query={query} />
          <ReviewsSearch query={query} />
          <ReviewsSourceMenu query={query} />
          <ReviewsRatingMenu query={query} />
          <ReviewsClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => reviewsHref(query, { page })}
          hrefForPageSize={(limit) => reviewsHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={<ReviewsEmpty query={query} />} />
    </DataTableFrame>
  );
}

/**
 * Ô rỗng của bảng. Đang lọc ngày thì nói THẲNG khoảng đang lọc và mở sẵn một
 * lối thoát — cùng lưới an toàn với `/bookings` và `/cancellations`.
 *
 * Ở hàng đợi kiểm duyệt câu này đáng giá hơn hai vùng kia: một bảng rỗng rất
 * dễ bị đọc thành "đã dọn sạch hàng đợi", trong khi thủ phạm chỉ là hai ô ngày
 * đặt từ lúc trước.
 */
function ReviewsEmpty({ query }: { query: ReviewsQuery }) {
  if (!query.from && !query.to) return <>{t.empty}</>;

  // Ba dạng câu cho ba hình dạng khoảng — 'between X.' cho khoảng một đầu là
  // câu cụt và đọc thành 'đúng ngày X'.
  const message =
    query.from && query.to
      ? t.emptyInRange(formatDateRange(query.from, query.to))
      : query.from
        ? t.emptyFrom(formatCalendarDate(query.from))
        : t.emptyTo(formatCalendarDate(query.to as string));

  return (
    <div className="flex flex-col items-center gap-2">
      <p>{message}</p>
      {/* Link chứ không nút: đổi bộ lọc là ĐIỀU HƯỚNG ở vùng này (spec P4b
          §2.2), và một link thì mở tab mới / copy được như mọi filter khác. */}
      <ButtonLink variant="outline" size="sm" href={reviewsHref(query, { from: null, to: null })}>
        <CalendarOffIcon data-icon="inline-start" aria-hidden="true" />
        {t.showAllDates}
      </ButtonLink>
    </div>
  );
}
