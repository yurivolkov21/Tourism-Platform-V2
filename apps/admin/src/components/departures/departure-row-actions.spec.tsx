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
    // Ba dòng ngữ cảnh: chuyến nào, mấy khách, hạn chót ngày nào.
    expect(screen.getByText(dates)).toBeInTheDocument();
    expect(screen.getByText(t.list.bookings(2))).toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
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
