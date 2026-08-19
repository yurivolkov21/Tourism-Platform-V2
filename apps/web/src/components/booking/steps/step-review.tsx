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
 * Khối "What's included / Not included" là thứ user chốt thêm ở vòng 2. Dữ liệu
 * lấy từ `TourDetailSchema.included/excluded` vốn đã có sẵn (cả 29 tour đều
 * đầy), nên khối này KHÔNG kéo theo thay đổi schema nào. Vẫn phòng trường hợp
 * rỗng: mảng rỗng thì bỏ hẳn khối thay vì để lại một hộp có tiêu đề mà không có
 * gì bên trong.
 */
export function StepReview({
  state,
  selected,
  currency,
  durationDays,
  included,
  excluded,
  onEdit,
}: StepShared & {
  durationDays: number;
  included: string[];
  excluded: string[];
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

      {included.length > 0 || excluded.length > 0 ? (
        <Group title={t.includedHeading}>
          {included.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {included.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="w-3.5 shrink-0 text-center text-muted-foreground"
                  >
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {excluded.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                {t.notIncludedHeading}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {excluded.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true" className="w-3.5 shrink-0 text-center">
                      ✕
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Group>
      ) : null}

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
