import { messages } from '@tourism/i18n';
import type { BookingStep } from '@/lib/booking-form';
import { formatDateRange, formatMoney } from '@/lib/tours';
import { CancellationAssuranceLine } from '../checkout-summary';
import type { StepShared } from './types';

/**
 * Bước 3 — đọc lại trước khi trả tiền. Không ô nhập nào.
 *
 * Bước này KHÔNG sở hữu trường nào trong `BookingFormState`, nên nó không bao
 * giờ tự chặn được. Muốn sửa gì thì bấm `Edit` để quay về đúng bước chứ không
 * sửa tại chỗ — hai chỗ nhập cho cùng một ô là hai chỗ phải giữ đồng bộ.
 *
 * KHÔNG có khối "What's included / Not included" ở đây. Nó từng được thêm ở vòng
 * 2 rồi GỠ ở vòng 3 (19/08) theo yêu cầu user — giữ màn checkout gọn. Dữ liệu
 * `TourDetailSchema.included/excluded` vẫn còn nguyên và vẫn hiện ở trang chi
 * tiết tour; đây chỉ là quyết định về chỗ đặt, không phải mất dữ liệu.
 */
export function StepReview({
  state,
  selected,
  currency,
  durationDays,
  onEdit,
}: StepShared & {
  durationDays: number;
  onEdit: (step: BookingStep) => void;
}) {
  const t = messages.booking.wizard.review;

  return (
    <div>
      <h2 className="font-semibold">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.sub}</p>

      <Group title={t.departure} onEdit={() => onEdit('dates')}>
        <Row
          k={t.dates}
          v={selected ? formatDateRange(selected.startDate, selected.endDate) : t.none}
        />
        <Row k={t.duration} v={messages.tourDetail.durationValue(durationDays)} />
        <Row
          k={t.pricePerPerson}
          v={selected ? formatMoney(selected.effectivePrice, currency) : t.none}
        />
      </Group>

      <Group title={t.travellers} onEdit={() => onEdit('travellers')}>
        <Row k={messages.booking.form.adults} v={String(state.numAdults)} />
        <Row k={messages.booking.form.children} v={String(state.numChildren)} />
      </Group>

      <Group title={t.contact} onEdit={() => onEdit('travellers')}>
        <Row k={t.name} v={state.contactName || t.none} />
        <Row k={t.email} v={state.contactEmail || t.none} />
        <Row k={t.phone} v={state.contactPhone || t.none} />
        <Row k={t.requests} v={state.specialRequests || t.none} />
      </Group>

      {/* Dùng LẠI đúng component của cột tóm tắt, không chép câu sang đây: các
          chuỗi i18n cố ý bỏ lửng để nối link chính sách ("… — see our"), nên
          một bản chỉ-chữ sẽ đọc cụt, và hai bản thì sớm muộn lệch nhau. */}
      {selected ? (
        <div className="mt-4 rounded-xl border bg-card p-3.5">
          <CancellationAssuranceLine departure={selected} />
        </div>
      ) : null}
    </div>
  );
}

/** Một khối chỉ-đọc, kèm link `Edit` khi khối đó sửa được. */
function Group({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2 rounded-xl border bg-card p-3.5 first-of-type:mt-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
          >
            {messages.booking.wizard.review.edit}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mt-1 flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}
