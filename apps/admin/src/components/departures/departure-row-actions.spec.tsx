import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDepartureRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDepartureRowVM } from '@/lib/departures-view';
import { DepartureRowActions } from './departure-row-actions';

/**
 * Hai nút của một hàng bảng chuyến (spec P4e-1 F12). Phần đáng pin là chuyện
 * nút nào ĐƯỢC BẤM, vì đó là nơi luật server hiện ra thành giao diện:
 *
 *  ① chuyến đã HUỶ không còn nút nào — bản ghi đóng;
 *  ② mở lại sau hạn chót thì nút tắt, chứ không mời bấm để ăn một 409;
 *  ③ hộp xác nhận ĐÓNG nói thẳng thứ KHÔNG xảy ra (khách cũ không được báo,
 *    không ai được hoàn tiền) — đó là câu phân biệt "đóng" với "huỷ".
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

const ROW: AdminDepartureRow = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 4,
  seatsTotal: 20,
  status: 'OPEN',
  cancellationDeadline: '2026-10-03',
  liveBookingCount: 2,
  pendingBookingCount: 0,
  version: '2026-09-20T08:00:00.000Z',
};

const BEFORE_DEADLINE = '2026-10-01';
const AFTER_DEADLINE = '2026-10-04';

function renderActions(
  row: AdminDepartureRow,
  today: string,
  setStatus = vi.fn(async () => ({
    ok: true as const,
    row: { ...row, status: 'CLOSED' as const },
  })),
) {
  const update = vi.fn();
  render(
    <DepartureRowActions
      row={toDepartureRowVM(row, today)}
      basePriceLabel="$129.00"
      update={update}
      setStatus={setStatus}
      disabled={false}
      onSettled={vi.fn()}
    />,
  );
  return { update, setStatus, dates: toDepartureRowVM(row, today).dates };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('DepartureRowActions — nút nào được bấm', () => {
  it('chuyến OPEN còn hạn: có Sửa và có Đóng', () => {
    const { dates } = renderActions(ROW, BEFORE_DEADLINE);

    expect(screen.getByRole('button', { name: t.edit.actionLabel(dates) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
  });

  it('chuyến CLOSED còn hạn: nút đổi thành Mở lại và bấm được', () => {
    const { dates } = renderActions({ ...ROW, status: 'CLOSED' }, BEFORE_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.reopenLabel(dates) })).toBeEnabled();
  });

  it('QUÁ HẠN CHÓT: nút Mở lại tắt — server sẽ từ chối, mời bấm là mời ăn lỗi', () => {
    const { dates } = renderActions({ ...ROW, status: 'CLOSED' }, AFTER_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.reopenLabel(dates) })).toBeDisabled();
  });

  it('chuyến ĐÃ HUỶ: KHÔNG có nút nào', () => {
    // Khách của nó đã được hoàn tiền (F13) — mỗi nút ở đây là một cách đi
    // vòng quanh việc ấy.
    renderActions({ ...ROW, status: 'CANCELLED' }, BEFORE_DEADLINE);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('DepartureRowActions — hộp xác nhận đóng chuyến', () => {
  it('nêu ngữ cảnh hàng, nói thẳng khách cũ KHÔNG bị đụng tới, và chưa bắn gì', async () => {
    const user = userEvent.setup();
    const { dates, setStatus } = renderActions(ROW, BEFORE_DEADLINE);

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));

    expect(await screen.findByText(t.setStatus.dialog.closeTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setStatus.dialog.closeWarning)).toBeInTheDocument();
    // Ba dòng ngữ cảnh: chuyến nào, mấy khách ĐÃ trả, hạn chót ngày nào.
    expect(screen.getByText(dates)).toBeInTheDocument();
    expect(screen.getByText(t.setStatus.rows.paidBookings)).toBeInTheDocument();
    // Không ai đang thanh toán dở → dòng ấy không có mặt, câu cảnh báo cũng vậy.
    expect(screen.queryByText(t.setStatus.rows.pendingBookings)).not.toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('CÒN checkout đang dở: thêm một dòng và một câu — họ sẽ bị hoàn tiền kèm email', async () => {
    // Câu gốc hứa khách "are told nothing", đúng với người ĐÃ trả nhưng sai
    // với người ĐANG trả: claim đòi chuyến còn mở, nên lượt thanh toán về sau
    // khi đóng sẽ bị từ chối rồi hoàn tiền tự động.
    const user = userEvent.setup();
    const { dates } = renderActions(
      { ...ROW, liveBookingCount: 5, pendingBookingCount: 2 },
      BEFORE_DEADLINE,
    );

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));

    expect(await screen.findByText(t.setStatus.rows.pendingBookings)).toBeInTheDocument();
    // Hai câu nằm trong CÙNG một thẻ cảnh báo của kit, nên tìm theo câu đầu
    // rồi soi nội dung — khớp trọn chuỗi sẽ trượt.
    expect(screen.getByText(t.setStatus.dialog.closeWarning, { exact: false })).toHaveTextContent(
      t.setStatus.dialog.closePendingWarning(2),
    );
  });

  it('xác nhận: gửi đúng `CLOSED` và toast đọc trạng thái TỪ RESPONSE', async () => {
    const user = userEvent.setup();
    const { dates, setStatus } = renderActions(ROW, BEFORE_DEADLINE);

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));
    await user.click(await screen.findByRole('button', { name: t.setStatus.dialog.closeSubmit }));

    expect(setStatus).toHaveBeenCalledWith({ id: ROW.id, status: 'CLOSED' });
    expect(success).toHaveBeenCalledWith(t.setStatus.toast.closedTitle, {
      description: t.setStatus.toast.closedBody(dates),
    });
  });
});

describe('DepartureRowActions — form sửa mang theo token phiên bản', () => {
  it('gửi kèm `version` CHỤP LÚC MỞ, không phải giá trị mới nhất của hàng', async () => {
    // Token là thứ duy nhất phát hiện được ghi đè mù giữa hai tab: `FOR UPDATE`
    // tuần tự hoá hai lệnh ghi nhưng không biết cái nào cũ, vì payload mang
    // giá trị từ FORM chứ không từ hàng vừa khoá. Đọc lại `row.version` lúc
    // gửi là tự vô hiệu hoá lớp ấy — một `router.refresh()` dưới chân dialog
    // sẽ đẩy token mới vào payload và server thấy hai giá trị bằng nhau.
    const user = userEvent.setup();
    const update = vi.fn(async () => ({ ok: true as const, row: ROW }));
    const vm = toDepartureRowVM(ROW, BEFORE_DEADLINE);
    const { rerender } = render(
      <DepartureRowActions
        row={vm}
        basePriceLabel="$129.00"
        update={update}
        setStatus={vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.dates) }));
    await screen.findByText(t.edit.dialog.title);

    // Bảng được vẽ lại dưới chân dialog đang mở — token của hàng đã đổi.
    rerender(
      <DepartureRowActions
        row={toDepartureRowVM({ ...ROW, version: '2026-09-21T09:00:00.000Z' }, BEFORE_DEADLINE)}
        basePriceLabel="$129.00"
        update={update}
        setStatus={vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.edit.dialog.submit }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: ROW.id, version: ROW.version }),
    );
  });
});
