import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDepartureRow } from '@tourism/contract';
import { DEPARTURE_SEATS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDepartureRow, serverRow } from '@/test/departure-row';
import { DepartureFormDialog } from './departure-form-dialog';

/**
 * Form thêm/sửa một chuyến (spec P4e-1 F12). Vòng đời lệnh ghi (pending, ba
 * lối ra) đã pin ở spec của `ConfirmWriteDialog`/`useConfirmWrite`; ở đây pin
 * phần DOMAIN, và ca quan trọng nhất là ca đầu tiên:
 *
 * **Ô ngày KHOÁ khi chuyến đã có booking sống, kèm câu giải thích NGAY DƯỚI
 * ô.** `Booking` giữ bản sao ngày khởi hành và ADR-0041 tính hạn huỷ từ bản
 * sao ấy (spec §2b) — một ô ngày mờ đi mà không nói vì sao là admin đi mở
 * ticket hỏi.
 */
const t = messages.admin.departures;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

/**
 * Response giả của lệnh lưu — dựng qua khuôn chung để `phase` và hạn chót do
 * chính hàm của contract điền. Bản chép tay trước đây ghi hạn chót 24/11 cho
 * chuyến 01/12 → 03/12, trong khi contract tính ra 28/11 (vòng review F16).
 */
const SAVED: AdminDepartureRow = serverRow(
  makeDepartureRow({ startDate: '2026-12-01', endDate: '2026-12-03', seatsTotal: 18 }),
  '2026-09-20',
);

const COPY = t.edit.dialog;

function renderDialog(
  props: Partial<React.ComponentProps<typeof DepartureFormDialog<'NOT_FOUND'>>> = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => ({ ok: true as const, row: SAVED }));
  const onSettled = props.onSettled ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  render(
    <DepartureFormDialog<'NOT_FOUND'>
      copy={COPY}
      formId="departure-edit-1"
      initial={{ startDate: '2026-12-01', endDate: '2026-12-03', seats: '18', price: '' }}
      seatsBooked={0}
      basePriceLabel="$129.00"
      isStale={() => true}
      errorCopy={() => t.edit.errors.NOT_FOUND}
      toast={() => ({ title: t.edit.toast.title, description: 'done' })}
      {...props}
      onSubmit={onSubmit}
      onClose={onClose}
      onSettled={onSettled}
    />,
  );
  return { onSubmit, onSettled, onClose };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('DepartureFormDialog — ô ngày và luật của nó', () => {
  it('chuyến CHƯA ai đặt: hai ô ngày mở, không có câu giải thích nào', () => {
    renderDialog();

    expect(screen.getByLabelText(t.form.startDate)).toBeEnabled();
    expect(screen.getByLabelText(t.form.endDate)).toBeEnabled();
    expect(screen.queryByText(t.form.datesLocked(1))).not.toBeInTheDocument();
  });

  it('chuyến ĐÃ có ghế bị giữ: hai ô ngày KHOÁ và câu giải thích hiện ra', () => {
    renderDialog({ seatsBooked: 4 });

    expect(screen.getByLabelText(t.form.startDate)).toBeDisabled();
    expect(screen.getByLabelText(t.form.endDate)).toBeDisabled();
    // Câu phải nói đúng số GHẾ đang chặn — cùng con số cột "Seats" in ra, và
    // cùng thước server dùng để từ chối. Nói "2 bookings" cạnh "4 / 20" là
    // mời admin nghi ngờ màn hình.
    expect(screen.getByText(t.form.datesLocked(4))).toBeInTheDocument();
  });

  it('giá và ghế VẪN sửa được trên chuyến đã có khách', () => {
    // Đây là nửa còn lại của luật §2b: chỉ NGÀY bị khoá, không phải cả hàng.
    renderDialog({ seatsBooked: 4 });

    expect(screen.getByLabelText(t.form.seats)).toBeEnabled();
    expect(screen.getByLabelText(t.form.price)).toBeEnabled();
  });
});

describe('DepartureFormDialog — validate trước khi bắn', () => {
  it('ghế hạ dưới số đã đặt: báo tại ô, KHÔNG gọi server', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ seatsBooked: 4 });

    const seats = screen.getByLabelText(t.form.seats);
    await user.clear(seats);
    await user.type(seats, '3');
    await user.click(screen.getByRole('button', { name: COPY.submit }));

    expect(await screen.findByText(t.form.errors.seatsBelowBooked(4))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sửa đúng lại thì câu lỗi tự biến — lỗi là DERIVED, không nằm trong state', async () => {
    const user = userEvent.setup();
    renderDialog({ seatsBooked: 4 });

    const seats = screen.getByLabelText(t.form.seats);
    await user.clear(seats);
    await user.type(seats, '3');
    await user.click(screen.getByRole('button', { name: COPY.submit }));
    expect(await screen.findByText(t.form.errors.seatsBelowBooked(4))).toBeInTheDocument();

    await user.clear(seats);
    await user.type(seats, '20');
    expect(screen.queryByText(t.form.errors.seatsBelowBooked(4))).not.toBeInTheDocument();
  });

  it('ô giá TRỐNG gửi đi `null`, không phải chuỗi rỗng', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: COPY.submit }));

    expect(onSubmit).toHaveBeenCalledWith({
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      seatsTotal: 18,
      priceOverride: null,
    });
  });

  it('thành công: toast + đóng dialog + báo cha refresh', async () => {
    const user = userEvent.setup();
    const { onClose, onSettled } = renderDialog();

    await user.click(screen.getByRole('button', { name: COPY.submit }));

    expect(success).toHaveBeenCalledWith(t.edit.toast.title, { description: 'done' });
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });

  it('mã TRẠNG-THÁI-CŨ: đóng dialog + toast lỗi + refresh, không mời bấm lại', async () => {
    const user = userEvent.setup();
    const { onClose, onSettled } = renderDialog({
      onSubmit: vi.fn(async () => ({ ok: false as const, code: 'NOT_FOUND' as const })),
    });

    await user.click(screen.getByRole('button', { name: COPY.submit }));

    expect(errorToast).toHaveBeenCalledWith(t.edit.errors.NOT_FOUND);
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });
});

describe('DepartureFormDialog — bàn phím và trợ năng (F12 vòng hai)', () => {
  it('bấm Enter trong một ô là GỬI form, không phải không làm gì', async () => {
    // Gõ xong rồi bấm Enter là phản xạ của mọi người từng điền form. Trước vòng
    // này khối ô chỉ là một `<div>`, nên Enter rơi vào hư không.
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ seatsBooked: 0 });

    await user.click(screen.getByLabelText(t.form.seats));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('ô nhập TRỎ tới gợi ý của nó, để trình đọc màn hình đọc cùng một lượt', () => {
    renderDialog({ seatsBooked: 0 });

    const seats = screen.getByLabelText(t.form.seats);
    const describedBy = seats.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // Id phải TỒN TẠI: trỏ vào một id rỗng còn tệ hơn không trỏ gì.
    const hint = document.getElementById(describedBy as string);
    expect(hint?.textContent).toBe(t.form.seatsHint(DEPARTURE_SEATS_MAX));
  });

  it('có lỗi thì ô trỏ tới CẢ gợi ý lẫn câu lỗi', async () => {
    const user = userEvent.setup();
    renderDialog({ seatsBooked: 4 });

    const seats = screen.getByLabelText(t.form.seats);
    await user.clear(seats);
    await user.type(seats, '3');
    await user.click(screen.getByRole('button', { name: COPY.submit }));
    await screen.findByText(t.form.errors.seatsBelowBooked(4));

    const ids = (seats.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
  });

  it('ô ngày bị KHOÁ vẫn trỏ tới câu giải thích vì sao nó khoá', () => {
    // Ô disabled không đọc được bằng chuột, nhưng trình đọc màn hình vẫn đọc
    // tới nó — và câu duy nhất giải thích vì sao lại nằm ở gợi ý.
    renderDialog({ seatsBooked: 4 });

    const start = screen.getByLabelText(t.form.startDate);
    const id = start.getAttribute('aria-describedby');
    expect(document.getElementById(id as string)?.textContent).toBe(t.form.datesLocked(4));
  });
});
