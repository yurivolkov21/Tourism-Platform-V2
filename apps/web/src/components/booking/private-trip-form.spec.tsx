import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivateTripForm } from './private-trip-form';

// Chỉ mock biên ra thế giới; phần dựng payload vẫn chạy thật để test canh được
// đúng shape gửi đi.
const createEnquiry = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: { enquiries: { create: (...args: unknown[]) => createEnquiry(...args) } },
  withBrowserAuth: () => ({}),
}));

const TOUR_ID = 'a1000001-0000-4000-8000-000000000001';
const BASE = {
  tourId: TOUR_ID,
  maxGroupSize: 10,
  defaultName: 'Elena Moreau',
  defaultEmail: 'elena.moreau@example.com',
};

const GOOD_MESSAGE = 'We would like a slower first day and one night in a homestay.';

beforeEach(() => {
  createEnquiry.mockReset();
});

describe('PrivateTripForm', () => {
  it('lời nhắn dưới 10 ký tự → chặn tại chỗ, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<PrivateTripForm {...BASE} />);

    await user.type(screen.getByLabelText(/Anything else/i), 'hi');
    await user.click(screen.getByRole('button', { name: /Request a quote/i }));

    // Ngưỡng min 10 là của contract (chặn "hi"/"test"). Bắt ở client để khách
    // không đi hết một round-trip mới biết enquiry bị từ chối.
    expect(createEnquiry).not.toHaveBeenCalled();
    expect(await screen.findByText(/valid name and email/i)).toBeInTheDocument();
  });

  it('hợp lệ → gửi payload đúng shape, groupSize là TỔNG người đi', async () => {
    const user = userEvent.setup();
    createEnquiry.mockResolvedValue({});
    render(<PrivateTripForm {...BASE} />);

    await user.type(screen.getByLabelText(/Anything else/i), GOOD_MESSAGE);
    await user.click(screen.getByRole('button', { name: /Children \+/ })); // 2 người lớn + 1 trẻ
    await user.click(screen.getByRole('button', { name: /Request a quote/i }));

    expect(createEnquiry).toHaveBeenCalledTimes(1);
    const payload = createEnquiry.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      tourId: TOUR_ID,
      email: 'elena.moreau@example.com',
      groupSize: 3,
      interests: [],
    });
    // Ngày và phone bỏ trống thì KHÔNG được gửi chuỗi rỗng.
    expect('travelDate' in payload).toBe(false);
    expect('phone' in payload).toBe(false);
    // Honeypot vắng mặt vì người thật không điền.
    expect('website' in payload).toBe(false);
  });

  it('gửi xong → thay form bằng lời xác nhận, nói rõ CHƯA thanh toán', async () => {
    const user = userEvent.setup();
    createEnquiry.mockResolvedValue({});
    render(<PrivateTripForm {...BASE} />);

    await user.type(screen.getByLabelText(/Anything else/i), GOOD_MESSAGE);
    await user.click(screen.getByRole('button', { name: /Request a quote/i }));

    expect(await screen.findByText(/Request sent/i)).toBeInTheDocument();
    // Câu quan trọng nhất của nhánh này phải còn nguyên sau khi gửi.
    expect(screen.getByText(/No payment now/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request a quote/i })).not.toBeInTheDocument();
  });

  it('chạm trần nhóm → nút cộng tắt ở CẢ hai bộ đếm', async () => {
    const user = userEvent.setup();
    render(<PrivateTripForm {...BASE} maxGroupSize={3} />);

    const plusAdults = screen.getByRole('button', { name: /Adults \+/ });
    await user.click(plusAdults); // 3 người lớn → chạm trần 3

    expect(plusAdults).toBeDisabled();
    expect(screen.getByRole('button', { name: /Children \+/ })).toBeDisabled();
  });

  it('chọn ngày qua DatePicker → trigger đổi hiển thị, submit gửi đúng YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    createEnquiry.mockResolvedValue({});
    render(<PrivateTripForm {...BASE} />);

    // Chốt ngày mục tiêu là ngày CUỐI của tháng đang hiển thị — luôn >= hôm
    // nay (vì hôm nay không bao giờ vượt quá ngày cuối tháng của chính nó),
    // nên chắc chắn KHÔNG bị `disabled={{ before: today }}` chặn, bất kể máy
    // chạy test vào ngày nào trong tháng.
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const targetDataDay = targetDate.toLocaleDateString();

    // Trigger được đặt tên qua `<label htmlFor>` của `Field` ("Preferred
    // start date"), KHÔNG phải nội dung hiển thị bên trong — nội dung đó
    // (placeholder rồi tới ngày đã chọn) phải đọc qua `textContent`.
    const trigger = screen.getByLabelText(/Preferred start date/i);
    expect(trigger).toHaveTextContent(/Pick a date/i);

    await user.click(trigger);
    // Nút ngày của react-day-picker có aria-label ĐẦY ĐỦ kiểu "Sunday, July
    // 26th, 2026" (không phải mỗi số ngày) — không lọc qua tên vai trò được.
    // `data-day` (gắn ở `CalendarDayButton`, `libs/shared/ui`) là định danh
    // đáng tin cậy duy nhất khớp ĐÚNG MỘT ô, kể cả khi ngày ngoài-tháng trùng số.
    const dayButton = await waitFor(() => {
      const btn = document.querySelector<HTMLButtonElement>(`[data-day="${targetDataDay}"]`);
      if (!btn) throw new Error(`Không tìm thấy ô ngày ${targetDataDay} trên calendar`);
      return btn;
    });
    await user.click(dayButton);

    // Nội dung trigger phải đổi từ placeholder sang ngày đã chọn, dạng
    // "D MMM YYYY" — ĐÚNG format của `formatDate` (`lib/tours.ts`).
    const MONTHS = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const expectedLabel = `${targetDate.getDate()} ${MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    expect(trigger).toHaveTextContent(expectedLabel);

    await user.type(screen.getByLabelText(/Anything else/i), GOOD_MESSAGE);
    await user.click(screen.getByRole('button', { name: /Request a quote/i }));

    const expectedISO = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(createEnquiry.mock.calls[0]?.[0]).toMatchObject({ travelDate: expectedISO });
  });

  it('throttle và lỗi thật cho hai câu KHÁC nhau', async () => {
    const user = userEvent.setup();
    // `classifySubmitError` đòi INSTANCE `ORPCError` thật (`instanceof`), không
    // phải object giả tay — dựng bằng đúng hàm mà `OpenAPILink` gọi, cùng khuôn
    // fixture đã dựng-từ-lỗi-thật ở `submit.spec.ts`.
    createEnquiry.mockRejectedValue(
      createORPCErrorFromJson({
        defined: false,
        code: 'TOO_MANY_REQUESTS',
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
        data: null,
      }),
    );
    render(<PrivateTripForm {...BASE} />);

    await user.type(screen.getByLabelText(/Anything else/i), GOOD_MESSAGE);
    await user.click(screen.getByRole('button', { name: /Request a quote/i }));

    // "chờ một phút" là việc khách LÀM ĐƯỢC; "thử lại" thì không.
    expect(await screen.findByText(/about a minute/i)).toBeInTheDocument();
    // Dữ liệu đã gõ phải còn nguyên.
    expect(screen.getByLabelText(/Anything else/i)).toHaveValue(GOOD_MESSAGE);
  });
});
