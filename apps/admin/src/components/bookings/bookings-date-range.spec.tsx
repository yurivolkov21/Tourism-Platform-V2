import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsQuery } from '@/lib/bookings-query';
import { BookingsDateRange } from './bookings-toolbar';

/**
 * Bộ lọc khoảng ngày của `/bookings` (spec P4b §3-F6), nay dựng bằng hai ô
 * `DatePickerField` kiểu `date-picker-04` (user chốt 01/09).
 *
 * Nó chỉ điều hướng — nhưng có một ca mà "chỉ điều hướng" là chưa đủ: khi giá
 * trị vừa chốt bị luật khoảng-ngược vứt đi, URL đích TRÙNG URL hiện tại nên
 * không có điều hướng nào xảy ra, và ô sẽ đứng đó khoe một bộ lọc không tồn
 * tại (review F6). Ô chữ tự do còn mở thêm một cửa cho cùng bệnh đó: gõ rác.
 */
const t = messages.admin.bookings.list;

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const BASE: BookingsQuery = { page: 1, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

describe('BookingsDateRange', () => {
  it('hai ô mang đúng khoảng đang lọc trên URL, dạng người đọc được', () => {
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);

    expect(screen.getByLabelText(t.dateFrom)).toHaveValue('September 01, 2026');
    expect(screen.getByLabelText(t.dateTo)).toHaveValue('September 30, 2026');
  });

  it('gõ ngày rồi rời ô → điều hướng sang URL mang from (dạng ISO)', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);

    await user.type(screen.getByLabelText(t.dateFrom), 'September 01, 2026');
    await user.tab();

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-01');
  });

  it('CHỈ chốt một lần, lúc rời ô — không phải mỗi phím một lần điều hướng', async () => {
    // Ô date native chỉ phát `change` khi đủ ba phần; ô chữ thì không có ranh
    // giới ấy, nên mỗi phím gõ mà đẩy URL là mỗi phím một lần fetch cả trang.
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);

    await user.type(screen.getByLabelText(t.dateFrom), 'September 01, 2026');
    expect(push).not.toHaveBeenCalled();

    await user.tab();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('Enter cũng chốt, không phải chờ rời ô', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);

    await user.type(screen.getByLabelText(t.dateFrom), 'September 01, 2026{Enter}');

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-01');
  });

  it('gõ rác: không điều hướng, và ô quay về đúng thứ đang lọc', async () => {
    // Ô chữ nhận được mọi thứ. Không kéo về thì màn hình khoe "linh tinh"
    // trong khi bảng vẫn lọc từ 01/09 — cùng bệnh "bộ lọc ma" của review F6.
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01' }} />);

    const field = screen.getByLabelText(t.dateFrom);
    await user.clear(field);
    await user.type(field, 'linh tinh');
    await user.tab();

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(t.dateFrom)).toHaveValue('September 01, 2026');
  });

  it('quét trắng một ô là bỏ lọc đầu đó', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);

    await user.clear(screen.getByLabelText(t.dateTo));
    await user.tab();

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-01');
  });

  it('ngày kết thúc SỚM HƠN ngày bắt đầu: không điều hướng, và ô tự quay về rỗng', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01' }} />);

    await user.type(screen.getByLabelText(t.dateTo), 'August 15, 2026');
    await user.tab();

    // URL đích trùng URL hiện tại (`to` bị vứt) → push là vô nghĩa…
    expect(push).not.toHaveBeenCalled();
    // …nên chính component phải kéo ô về đúng thứ đang lọc, kẻo màn hình
    // hiện "đến 15/08" trong khi bảng lọc từ 01/09 trở đi. Truy vấn LẠI: đổi
    // `key` là unmount + mount, nên node cũ không còn nằm trong tài liệu.
    expect(screen.getByLabelText(t.dateTo)).toHaveValue('');
  });

  it('khoảng ngược từ TRANG 2+ cũng vậy — không được nhảy về trang 1 mà chẳng lọc thêm gì', async () => {
    // Vòng vá review F6 lần 2: guard bản đầu so `next` với href-hiện-tại
    // trần, nhưng patch (dù bị vứt) vẫn reset page nên từ page>1 hai chuỗi
    // khác nhau CHỈ VÌ page — push chạy thật (bảng nhảy trang, `to` vẫn bị
    // vứt) và ô lại khoe bộ lọc ma. Guard giờ ghim page ở cả hai vế.
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, page: 3, from: '2026-09-01' }} />);

    await user.type(screen.getByLabelText(t.dateTo), 'August 15, 2026');
    await user.tab();

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(t.dateTo)).toHaveValue('');
  });

  it('gõ dở rồi bấm icon lịch: KHÔNG chốt bản nháp, lịch mở được ngay lần đầu', async () => {
    // Vòng vá review 02/09: mousedown vào nút lịch làm ô blur; blur từng chốt
    // bản nháp → điều hướng → `key` của ô đổi → ô remount với `open=false` →
    // lịch đóng ngay khi vừa mở. Nay blur bỏ qua khi focus chỉ đi sang chính
    // bộ chọn này.
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-10' }} />);

    await user.clear(screen.getByLabelText(t.dateFrom));
    await user.type(screen.getByLabelText(t.dateFrom), 'September 20, 2026');
    await user.click(screen.getByRole('button', { name: t.pickDateFrom }));

    expect(push).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: /September 15th, 2026/i }),
    ).toBeInTheDocument();
  });

  it('chọn ngày trên lịch cũng chốt ngay, không cần rời ô', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-10' }} />);

    await user.click(screen.getByRole('button', { name: t.pickDateFrom }));
    // Lịch mở đúng tháng đang lọc (09/2026), nên nhãn ngày là đủ để trỏ.
    await user.click(await screen.findByRole('button', { name: /September 15th, 2026/i }));

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-15');
  });

  it('nút xoá chỉ hiện khi có ngày, và xoá CẢ HAI đầu trong một cú bấm', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BookingsDateRange query={BASE} />);
    expect(screen.queryByRole('button', { name: t.clearDates })).not.toBeInTheDocument();

    rerender(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);
    await user.click(screen.getByRole('button', { name: t.clearDates }));

    expect(push).toHaveBeenCalledWith('/bookings');
  });

  it('nút xoá vẫn hiện khi mới có một đầu', () => {
    render(<BookingsDateRange query={{ ...BASE, to: '2026-09-30' }} />);

    expect(screen.getByRole('button', { name: t.clearDates })).toBeInTheDocument();
  });
});
