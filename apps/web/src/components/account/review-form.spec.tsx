import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReview } from '@/test/fixtures/booking';
import { ReviewForm } from './review-form';

const { create, update } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { reviews: { create, update } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

const CODE = 'BK-REVIEW01';

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
  update.mockResolvedValue({});
});

describe('ReviewForm — chặn ở client theo đúng ràng buộc contract', () => {
  it('chưa chọn sao → KHÔNG gọi API, báo ngay', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.type(screen.getByLabelText(/your review/i), 'A perfectly fine trip.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText('Pick a rating from 1 to 5 stars.')).toBeInTheDocument();
  });

  it('bài viết ngắn hơn 10 ký tự → chặn, nói rõ CON SỐ', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Good');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText('Please write at least 10 characters.')).toBeInTheDocument();
  });

  it('chỉ khoảng trắng cũng bị chặn', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), '              ');
    await user.click(screen.getByRole('button', { name: /submit review/i }));
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ReviewForm — chọn sao là RADIO thật', () => {
  it('mỗi sao là một radio, đọc được "N stars"', () => {
    render(<ReviewForm bookingCode={CODE} />);
    // Một hàng <div onClick> trông giống hệt nhưng mất phím mũi tên và mất
    // cả tên khả truy cập.
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('radio', { name: '1 star' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 stars' })).toBeInTheDocument();
  });
});

describe('ReviewForm — gửi', () => {
  it('gửi đúng payload và BỎ HẲN title khi rỗng', async () => {
    // Contract khai `title` optional; gửi chuỗi rỗng khác hẳn không gửi.
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Guides were excellent throughout.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        { bookingCode: CODE, rating: 4, body: 'Guides were excellent throughout.' },
        expect.anything(),
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('có title thì gửi kèm, đã trim', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/title/i), '  Unforgettable  ');
    await user.type(screen.getByLabelText(/your review/i), 'Ten out of ten, would go again.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Unforgettable' }),
        expect.anything(),
      ),
    );
  });

  it('có photos → payload create kèm photos ĐÚNG THỨ TỰ composer truyền vào', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} photos={['a', 'b']} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Photos attached to this trip.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ photos: ['a', 'b'] }),
        expect.anything(),
      ),
    );
  });

  it('photosBusy → nút submit disabled, chưa xong ảnh thì chưa gửi được', () => {
    render(<ReviewForm bookingCode={CODE} photosBusy />);
    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();
  });

  it('409 đã review rồi → copy RIÊNG, không phải câu chung', async () => {
    create.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: true,
        code: 'REVIEW_ALREADY_EXISTS',
        status: 409,
        message: 'exists',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Trying to review twice here.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText('You’ve already reviewed this trip.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('REVIEW_TRIP_NOT_COMPLETED có copy riêng — mã này trước đây rơi vào generic', async () => {
    create.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: true,
        code: 'REVIEW_TRIP_NOT_COMPLETED',
        status: 400,
        message: 'not finished',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Reviewing far too early.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(
      await screen.findByText('You can review this trip once it has finished.'),
    ).toBeInTheDocument();
  });

  it('lỗi lạ → câu chung, KHÔNG sập trang', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Network will fail on this one.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

/**
 * Form ở lại sau khi gửi (ADR-0032: còn sửa được tới lúc duyệt), nên tự nó không nói "đã gửi" — dấu
 * hiệu duy nhất là dòng trạng thái đầu khung và chữ trên nút; thử tay prod 09/10 tưởng nút không chạy.
 * Toast nói thay, cùng câu với màn "đã gửi" của app mobile (`successTitle`/`successBody`).
 */
describe('ReviewForm — gửi xong thì báo bằng toast', () => {
  const t = messages.reviews;

  it('gửi lần đầu thành công → toast cảm ơn', async () => {
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Guides were excellent throughout.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.successTitle, { description: t.successBody }),
    );
  });

  it('gửi lại bài đang chờ duyệt → reviews.update theo id, cùng toast, không tạo bài mới', async () => {
    const review = makeReview({ rating: 4, body: 'A lovely trip with great guides.' });
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} review={review} />);
    await user.click(screen.getByRole('button', { name: t.resubmit }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        { id: review.id, rating: 4, body: 'A lovely trip with great guides.' },
        expect.anything(),
      ),
    );
    expect(success).toHaveBeenCalledWith(t.successTitle, { description: t.successBody });
    expect(create).not.toHaveBeenCalled();
  });

  it('API báo lỗi → không toast cảm ơn, chỉ câu lỗi trong form', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ReviewForm bookingCode={CODE} />);
    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'Network will fail on this one.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(t.errors.generic)).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });
});
