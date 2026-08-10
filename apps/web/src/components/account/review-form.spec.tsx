import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewForm } from './review-form';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
  api: { reviews: { create } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const CODE = 'BK-REVIEW01';

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
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
